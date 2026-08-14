import type { SearchHit } from "@/lib/search/keyword-search";
import type { InboxItem } from "@/lib/read-later/bucketing";

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  ja: "Japanese (日本語)",
};

export function buildSourceBlocks(hits: SearchHit[]): string {
  return hits
    .map((hit, i) => {
      const excerpt = (hit.extractedText ?? hit.description ?? hit.summary ?? "").slice(0, 800);
      return `[${i + 1}] ${hit.title ?? hit.url} (${hit.domain ?? hit.url})\n${excerpt}`;
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

export function buildAskSystemPrompt(
  sourceBlocks: string,
  targetLanguage: string,
  readingListBlock: string
): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  return `You are Hazy, an assistant that answers questions using ONLY the user's own saved reading, given below as numbered sources, plus their current "read later" list. Rules:
- Answer only from the sources and read later list provided. If they don't contain an answer, say so plainly — don't invent one.
- Cite sources inline with bracketed numbers like [1], [2] matching the numbered source list. The read later list below is unnumbered — refer to those items by title instead of a bracketed number.
- Reply in ${languageName}, regardless of the language the sources are written in.
- Keep the answer warm and conversational, a few sentences, not a bulleted report.

Sources:
${sourceBlocks || "(no matching sources found in the user's library)"}

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
