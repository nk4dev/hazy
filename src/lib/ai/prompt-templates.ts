import type { SearchHit } from "@/lib/search/keyword-search";
import type { InboxItem } from "@/lib/read-later/bucketing";

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  ja: "Japanese (日本語)",
};

// Formats search_saved_links tool results for the model. `number` is the
// citation number to tag each hit with — assigned by the caller so it stays
// consistent (no renumbering duplicates) across multiple tool calls in the
// same turn, since the model is instructed to cite using these numbers.
// Kept short on purpose — this text is prompt tokens spent on every tool
// call, and a full-length excerpt isn't needed for the model to ground a
// short conversational answer.
const SEARCH_RESULT_EXCERPT_LENGTH = 400;

export function formatSearchResults(items: { hit: SearchHit; number: number }[]): string {
  if (items.length === 0) return "No saved links matched that query.";
  return items
    .map(({ hit, number }) => {
      const excerpt = (hit.extractedText ?? hit.description ?? hit.summary ?? "").slice(
        0,
        SEARCH_RESULT_EXCERPT_LENGTH
      );
      return `[${number}] ${hit.title ?? hit.url} (${hit.domain ?? hit.url})\n${excerpt}`;
    })
    .join("\n\n");
}

// "What's in my read later list" is a question about app state (the
// readLaterState table), not about any saved page's own content — no
// amount of keyword/content matching over `hits` can answer it. This
// block gives the model that state directly so it can answer without
// inventing an answer or wrongly claiming it has no relevant sources.
export function buildReadingListBlock(items: InboxItem[]): string {
  if (items.length === 0) return "(empty — nothing is currently in the read later list)";
  return items
    .map((item) => `- ${item.title ?? item.url} (${item.domain ?? item.url})`)
    .join("\n");
}

export function buildAskSystemPrompt(targetLanguage: string, readingListBlock: string): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  return `You are Hazy, an assistant that answers questions using ONLY the user's own saved reading (their bookmarked links), plus their current "read later" list. Rules:
- You have a search_saved_links tool. Call it — more than once, with different queries, if that helps — to find saved pages relevant to the question before answering. Don't answer from general knowledge; ground every claim in what the tool returns or the read later list below.
- If the tool results and read later list don't contain an answer, say so plainly — don't invent one.
- Cite saved links inline with bracketed numbers like [1], [2] matching the numbers the tool gave each result. The read later list below is unnumbered — refer to those items by title instead of a bracketed number.
- Reply in ${languageName}, regardless of the language the sources are written in.
- Keep the answer warm and conversational, a few sentences, not a bulleted report.

Current "read later" list:
${readingListBlock}`;
}

export function buildSummarizePrompt(
  item: { title: string | null; url: string; description: string | null; extractedText: string | null },
  targetLanguage: string
): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  const body = (item.extractedText ?? item.description ?? "").slice(0, 6000);
  return `Summarize the following saved page in ${languageName}, in 2-4 concise sentences. Focus on the key point or takeaway, not a generic description of what the page is.

Title: ${item.title ?? item.url}
URL: ${item.url}

Content:
${body || "(no extracted content available — summarize based on the title and URL alone, or say plainly that there isn't enough information to summarize)"}`;
}
