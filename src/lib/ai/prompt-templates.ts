import type { InboxItem } from "@/lib/read-later/bucketing";
import type { SearchHit } from "@/lib/search/keyword-search";

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
  return items.map((item) => `- ${item.title ?? item.url} (${item.domain ?? item.url})`).join("\n");
}

export function buildAskSystemPrompt(
  targetLanguage: string,
  readingListBlock: string,
  attachedSourcesBlock = ""
): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  const todayIso = new Date().toISOString().slice(0, 10);
  const attachedSection = attachedSourcesBlock
    ? `\n\nThe user explicitly attached these saved links (via @collection). They are already numbered — cite them with those same bracketed numbers, and any results the search_saved_links tool returns are numbered continuing after them. Treat these as directly relevant to the question and use them in your answer, alongside anything you find with the tool:
${attachedSourcesBlock}`
    : "";
  return `You are Hazy, an assistant that answers questions using ONLY the user's own saved reading (their bookmarked links), plus their current "read later" list. Rules:
- Today's date is ${todayIso}.
- You have a search_saved_links tool. Call it — more than once, with different queries, if that helps — to find saved pages relevant to the question before answering. Don't answer from general knowledge; ground every claim in what the tool returns, the attached links, or the read later list below.
- The tool accepts optional dateFrom/dateTo (YYYY-MM-DD, inclusive) to filter by when a link was saved. Use them whenever the question refers to a time period — relative (e.g. "last week", "先週", "今月", "this year") or absolute (e.g. "in March", "2024年") — computing the actual dates from today's date above.
- If the tool results, attached links, and read later list don't contain an answer, say so plainly — don't invent one.
- Cite saved links inline with bracketed numbers like [1], [2] matching the numbers given each result. The read later list below is unnumbered — refer to those items by title instead of a bracketed number.
- Reply in ${languageName}, regardless of the language the sources are written in.
- Keep the answer warm and conversational, a few sentences, not a bulleted report.

Current "read later" list:
${readingListBlock}${attachedSection}`;
}

const ATTACHED_SOURCE_EXCERPT_LENGTH = 300;

/**
 * Renders links the user pinned to the question by @-mentioning a collection,
 * numbered from 1 so the numbers line up with the citation list the pipeline
 * seeds the tool-calling loop with (search results are numbered after these).
 */
export function buildAttachedSourcesBlock(
  hits: {
    title: string | null;
    url: string;
    domain: string | null;
    summary: string | null;
    description: string | null;
    collectionName: string;
  }[]
): string {
  if (hits.length === 0) return "";
  return hits
    .map((hit, index) => {
      const excerpt = (hit.summary ?? hit.description ?? "")
        .replace(/\s+/g, " ")
        .slice(0, ATTACHED_SOURCE_EXCERPT_LENGTH);
      return `[${index + 1}] ${hit.title ?? hit.url} — ${hit.url} (from "${hit.collectionName}")${
        excerpt ? `\n${excerpt}` : ""
      }`;
    })
    .join("\n\n");
}

export function buildSummarizePrompt(
  item: {
    title: string | null;
    url: string;
    description: string | null;
    extractedText: string | null;
  },
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

const COLLECTION_ITEM_EXCERPT_LENGTH = 500;
const COLLECTION_SUMMARY_MAX_ITEMS = 40;

export function buildCollectionSummaryPrompt(
  collection: { name: string; description: string | null },
  items: {
    title: string | null;
    url: string;
    domain: string | null;
    description: string | null;
    summary: string | null;
    extractedText: string | null;
  }[],
  targetLanguage: string
): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  const list = items
    .slice(0, COLLECTION_SUMMARY_MAX_ITEMS)
    .map((item, index) => {
      const excerpt = (item.summary ?? item.description ?? item.extractedText ?? "")
        .replace(/\s+/g, " ")
        .slice(0, COLLECTION_ITEM_EXCERPT_LENGTH);
      return `${index + 1}. ${item.title ?? item.url} (${item.domain ?? item.url})\n${excerpt || "(no description available)"}`;
    })
    .join("\n\n");

  return `Write an overview of the following collection of saved links in ${languageName}, in 3-5 sentences. Describe what ties these links together — the common themes, topics, or purpose — and note any notable sub-groups. Write it as a cohesive paragraph, not a list, and don't just restate the collection's name.

Collection name: ${collection.name}
${collection.description ? `Collection description: ${collection.description}\n` : ""}
Saved links (${items.length} total${items.length > COLLECTION_SUMMARY_MAX_ITEMS ? `, showing first ${COLLECTION_SUMMARY_MAX_ITEMS}` : ""}):
${list || "(this collection has no links yet)"}`;
}
