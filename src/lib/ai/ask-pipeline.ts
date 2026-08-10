import { eq, asc } from "drizzle-orm";
import type OpenAI from "openai";
import { getDb } from "@/db";
import { askThreads, askMessages, askMessageCitations, userPreferences } from "@/db/schema";
import { searchUserItems, getRecentUserItems } from "@/lib/search/keyword-search";
import { getReadLaterQueue } from "@/lib/read-later/get-queue";
import { buildAskSystemPrompt, buildSourceBlocks, buildReadingListBlock } from "@/lib/ai/prompt-templates";
import { askOpenRouter } from "@/lib/ai/openrouter";
import { isOpenRouterConfigured, env } from "@/lib/env";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AskResponseDTO } from "@/types/api";
import type { AppUser } from "@/lib/auth/current-user";

const SOURCE_LIMIT = 6;

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

export async function runAskPipeline(params: {
  user: AppUser;
  question: string;
  threadId?: string;
  answerLanguageOverride?: string;
}): Promise<AskResponseDTO> {
  const { user, question, threadId, answerLanguageOverride } = params;
  const db = getDb();

  let hits = await searchUserItems(user.id, question, { limit: SOURCE_LIMIT });
  if (hits.length === 0) {
    // No keyword overlap between the question and any saved item (common
    // for natural-language questions, or a library in a different
    // language than the question). Fall back to the user's whole library
    // instead of reporting no sources — let the model see what's saved
    // and decide whether it's relevant.
    hits = await getRecentUserItems(user.id, SOURCE_LIMIT);
  }
  const readLaterQueue = await getReadLaterQueue(user.id);
  const targetLanguage = await resolveTargetLanguage(
    user.id,
    hits[0]?.contentLanguage ?? null,
    answerLanguageOverride
  );

  let thread;
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
    priorMessages = existing.map((m) => ({ role: m.role, content: m.content }));
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

  const sourceBlocks = buildSourceBlocks(hits);
  const readingListBlock = buildReadingListBlock(readLaterQueue);
  const systemPrompt = buildAskSystemPrompt(sourceBlocks, targetLanguage, readingListBlock);

  let answerText: string;
  let usedFallback = false;

  const fallbackText = FALLBACK_TEXT[targetLanguage] ?? FALLBACK_TEXT.en;

  if (!isOpenRouterConfigured()) {
    usedFallback = true;
    answerText = hits.length > 0 ? fallbackText.withSources : fallbackText.empty;
  } else {
    try {
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...priorMessages.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.ChatCompletionMessageParam),
        { role: "user", content: question },
      ];
      answerText = await askOpenRouter(chatMessages);
    } catch (error) {
      console.error("OpenRouter call failed, falling back:", error);
      usedFallback = true;
      answerText = hits.length > 0 ? fallbackText.withSources : fallbackText.empty;
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

  if (hits.length > 0) {
    await db.insert(askMessageCitations).values(
      hits.map((hit, i) => ({
        messageId: assistantMessage.id,
        savedUrlId: hit.id,
        rank: i + 1,
        snippet: (hit.description ?? hit.summary ?? hit.extractedText ?? "").slice(0, 240),
      }))
    );
  }

  const citations = hits.map((hit, i) => {
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
    meta: { sourceCount: hits.length },
  };
}
