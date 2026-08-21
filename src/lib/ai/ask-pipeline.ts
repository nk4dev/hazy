import { asc, eq } from "drizzle-orm";
import type OpenAI from "openai";
import { getDb } from "@/db";
import { askMessageCitations, askMessages, askThreads, userPreferences } from "@/db/schema";
import {
  runSearchSavedLinksTool,
  SEARCH_SAVED_LINKS_TOOL,
  SEARCH_SAVED_LINKS_TOOL_NAME,
} from "@/lib/ai/ask-tools";
import { createChatCompletion } from "@/lib/ai/openrouter";
import {
  buildAskSystemPrompt,
  buildReadingListBlock,
  formatSearchResults,
} from "@/lib/ai/prompt-templates";
import type { AppUser } from "@/lib/auth/current-user";
import { env, isOpenRouterConfigured } from "@/lib/env";
import { getReadLaterQueue } from "@/lib/read-later/get-queue";
import { getRecentUserItems, type SearchHit, searchUserItems } from "@/lib/search/keyword-search";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AskResponseDTO } from "@/types/api";

const SOURCE_LIMIT = 6;
const MAX_TOOL_ROUNDS = 4;
// Caps how much prior thread history is replayed into the model on each
// follow-up — without this, prompt tokens grow linearly (unbounded) with
// thread length. Recent turns matter far more than early ones for a
// conversational follow-up, so only the tail is kept.
const MAX_HISTORY_MESSAGES = 12;

// Persisted messages are plain text (not translation keys) since they live
// in the DB and get read back verbatim later. Kept in sync with
// messages/{en,ja}.json's ask.aiUnavailable / ask.noResults.
const FALLBACK_TEXT: Record<string, { withSources: string; empty: string }> = {
  en: {
    withSources: "AI answers aren't configured yet — here's what matched your library.",
    empty: "Nothing in your library matches that yet.",
  },
  ja: {
    withSources: "AIによる回答はまだ設定されていません — ライブラリから一致したものはこちらです。",
    empty: "まだライブラリに一致するものがありません。",
  },
};

async function resolveTargetLanguage(
  userId: string,
  topSourceLanguage: string | null,
  override?: string
): Promise<string> {
  if (override) return override;
  const db = getDb();
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (prefs?.answerLanguageMode === "source" && topSourceLanguage) {
    return topSourceLanguage;
  }
  return prefs?.interfaceLocale ?? "en";
}

/**
 * Drives the OpenRouter tool-calling loop: the model can call
 * search_saved_links (possibly more than once, with different queries)
 * before producing its final answer, instead of being handed a fixed
 * pre-fetched source list. Search results are numbered globally across
 * every call in this turn — including repeats of an already-seen link —
 * so the numbers the model cites with line up 1:1 with the citation list
 * built from `hits` afterward.
 */
async function runToolCallingAsk(
  userId: string,
  systemPrompt: string,
  priorMessages: { role: "user" | "assistant"; content: string }[],
  question: string
): Promise<{ answerText: string; hits: SearchHit[] }> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...priorMessages.map(
      (m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.ChatCompletionMessageParam
    ),
    { role: "user", content: question },
  ];

  const hits: SearchHit[] = [];
  const seenIds = new Set<string>();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const message = await createChatCompletion(messages, { tools: [SEARCH_SAVED_LINKS_TOOL] });

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (!message.content) throw new Error("OpenRouter returned an empty response.");
      return { answerText: message.content, hits };
    }

    messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function" || toolCall.function.name !== SEARCH_SAVED_LINKS_TOOL_NAME) {
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Unknown tool." });
        continue;
      }
      const results = await runSearchSavedLinksTool(userId, toolCall.function.arguments);
      for (const hit of results) {
        if (!seenIds.has(hit.id)) {
          seenIds.add(hit.id);
          hits.push(hit);
        }
      }
      const resultText = formatSearchResults(
        results.map((hit) => ({ hit, number: hits.findIndex((h) => h.id === hit.id) + 1 }))
      );
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: resultText });
    }
  }

  throw new Error("OpenRouter tool-calling loop exceeded max rounds without a final answer.");
}

export async function runAskPipeline(params: {
  user: AppUser;
  question: string;
  threadId?: string;
  answerLanguageOverride?: string;
}): Promise<AskResponseDTO> {
  const { user, question, threadId, answerLanguageOverride } = params;
  const db = getDb();

  // A cheap upfront search — used only for target-language detection and as
  // the deterministic fallback (canned text + citations) when OpenRouter is
  // unconfigured or errors out. The AI path itself no longer gets these
  // handed to it directly; it searches live via the search_saved_links tool.
  let fallbackHits = await searchUserItems(user.id, question, { limit: SOURCE_LIMIT });
  if (fallbackHits.length === 0) {
    // No keyword overlap between the question and any saved item (common
    // for natural-language questions, or a library in a different
    // language than the question). Fall back to the user's whole library
    // instead of reporting no sources — let the model see what's saved
    // and decide whether it's relevant.
    fallbackHits = await getRecentUserItems(user.id, SOURCE_LIMIT);
  }
  const readLaterQueue = await getReadLaterQueue(user.id);
  const targetLanguage = await resolveTargetLanguage(
    user.id,
    fallbackHits[0]?.contentLanguage ?? null,
    answerLanguageOverride
  );

  let thread: typeof askThreads.$inferSelect | undefined;
  let priorMessages: { role: "user" | "assistant"; content: string }[] = [];

  if (threadId) {
    thread = await db.query.askThreads.findFirst({
      where: eq(askThreads.id, threadId),
    });
    if (!thread || thread.userId !== user.id) {
      throw new Error("Thread not found");
    }
    const existing = await db.query.askMessages.findMany({
      where: eq(askMessages.threadId, threadId),
      orderBy: [asc(askMessages.createdAt)],
    });
    // Only the most recent turns are sent to the model — see
    // MAX_HISTORY_MESSAGES. `existing` (full history) is still what's used
    // everywhere else (thread display, etc.); this slice is AI-input only.
    priorMessages = existing
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));
  } else {
    const [created] = await db
      .insert(askThreads)
      .values({ userId: user.id, title: question.slice(0, 120) })
      .returning();
    thread = created;
  }

  await db.insert(askMessages).values({
    threadId: thread.id,
    role: "user",
    content: question,
  });

  const readingListBlock = buildReadingListBlock(readLaterQueue);
  const systemPrompt = buildAskSystemPrompt(targetLanguage, readingListBlock);

  let answerText: string;
  let usedFallback = false;
  let citationHits: SearchHit[] = fallbackHits;

  const fallbackText = FALLBACK_TEXT[targetLanguage] ?? FALLBACK_TEXT.en;

  if (!isOpenRouterConfigured()) {
    usedFallback = true;
    answerText = fallbackHits.length > 0 ? fallbackText.withSources : fallbackText.empty;
  } else {
    try {
      const result = await runToolCallingAsk(user.id, systemPrompt, priorMessages, question);
      answerText = result.answerText;
      citationHits = result.hits;
    } catch (error) {
      console.error("OpenRouter call failed, falling back:", error);
      usedFallback = true;
      answerText = fallbackHits.length > 0 ? fallbackText.withSources : fallbackText.empty;
      citationHits = fallbackHits;
    }
  }

  const [assistantMessage] = await db
    .insert(askMessages)
    .values({
      threadId: thread.id,
      role: "assistant",
      content: answerText,
      modelId: usedFallback ? null : env.OPENROUTER_MODEL_ID,
      usedFallback,
    })
    .returning();

  if (citationHits.length > 0) {
    await db.insert(askMessageCitations).values(
      citationHits.map((hit, i) => ({
        messageId: assistantMessage.id,
        savedUrlId: hit.id,
        rank: i + 1,
        snippet: (hit.description ?? hit.summary ?? hit.extractedText ?? "").slice(0, 240),
      }))
    );
  }

  const citations = citationHits.map((hit, i) => {
    const dto = serializeSavedUrl(hit);
    return {
      savedUrlId: hit.id,
      title: dto.title,
      domain: dto.domain,
      url: dto.url,
      faviconUrl: dto.faviconUrl,
      snippet: (hit.description ?? hit.summary ?? hit.extractedText ?? "").slice(0, 240),
      rank: i + 1,
    };
  });

  return {
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    },
    message: {
      id: assistantMessage.id,
      role: "assistant",
      content: answerText,
      modelId: assistantMessage.modelId,
      usedFallback: assistantMessage.usedFallback,
      createdAt: assistantMessage.createdAt.toISOString(),
    },
    citations,
    meta: { sourceCount: citationHits.length },
  };
}
