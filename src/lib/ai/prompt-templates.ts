import type { SearchHit } from "@/lib/search/keyword-search";

const LANGUAGE_NAME: Record<string, string> = {
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

export function buildAskSystemPrompt(sourceBlocks: string, targetLanguage: string): string {
  const languageName = LANGUAGE_NAME[targetLanguage] ?? targetLanguage;
  return `You are Hazy, an assistant that answers questions using ONLY the user's own saved reading, given below as numbered sources. Rules:
- Answer only from the sources provided. If they don't contain an answer, say so plainly — don't invent one.
- Cite sources inline with bracketed numbers like [1], [2] matching the source list.
- Reply in ${languageName}, regardless of the language the sources are written in.
- Keep the answer warm and conversational, a few sentences, not a bulleted report.

Sources:
${sourceBlocks || "(no matching sources found in the user's library)"}`;
}
