// Pure, framework-free search helpers. Shared by the /search page (client,
// over `Note` / `Item` DTOs) and the chat route (server, over DB rows). The
// semantic embedding itself lives in the page — everything here is sync and
// unit-testable.

import { deltaToPlainText } from "./note-delta";
import type { Item, Note, SearchHit, SourceKind } from "./types";

/** Normalised search unit — a note or a saved source flattened to text. */
export interface SearchDoc {
  id: string;
  kind: SourceKind;
  title: string;
  /** Body / summary / points, already joined to plain text. */
  text: string;
  tags: string[];
  href: string;
  external: boolean;
}

const norm = (s: string): string => s.toLowerCase().normalize("NFKC");

export function noteToDoc(n: Note): SearchDoc {
  return {
    id: n.id,
    kind: "note",
    title: n.title,
    text: deltaToPlainText(n.body).replace(/\s+/g, " ").trim(),
    tags: n.tags.map((t) => t.label),
    href: `/notes/${n.id}`,
    external: false,
  };
}

export function itemToDoc(it: Item): SearchDoc {
  return {
    id: it.id,
    kind: it.kind,
    title: it.title,
    text: [it.site, ...it.summary, ...it.points].filter(Boolean).join(" "),
    tags: [...new Set([...it.tags, ...it.suggestedTags])],
    href: it.url,
    external: true,
  };
}

/** Notes first, then sources — the order the /search list and chat context use. */
export function buildCorpus(notes: Note[], items: Item[]): SearchDoc[] {
  return [...notes.map(noteToDoc), ...items.filter((it) => it.kind !== "note").map(itemToDoc)];
}

/** Split a query into terms; quoted "…" stays one term. */
export function queryTerms(q: string): string[] {
  const terms: string[] = [];
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = (m[1] ?? m[2] ?? "").trim();
    if (t) terms.push(norm(t));
  }
  return terms;
}

/** A ~140-char window around the first term hit, else the leading text. */
export function snippet(doc: SearchDoc, terms: string[] = [], max = 140): string {
  const flat = doc.text.replace(/\s+/g, " ").trim();
  if (!flat) return doc.tags.length ? `#${doc.tags.join(" #")}` : "…";
  const hay = norm(flat);
  let at = -1;
  for (const t of terms) {
    const i = hay.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.length > max ? `${flat.slice(0, max)}…` : flat;
  const start = Math.max(0, at - 40);
  const out = flat.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${out}${start + max < flat.length ? "…" : ""}`;
}

export function toHit(doc: SearchDoc, terms: string[] = [], score?: number): SearchHit {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title || "(無題)",
    snippet: snippet(doc, terms),
    tags: doc.tags,
    href: doc.href,
    external: doc.external,
    ...(score !== undefined ? { score } : {}),
  };
}

/**
 * Keyword search. Every term must appear somewhere (title, body or a tag);
 * title and tag hits rank above body-only hits, earlier docs break ties.
 */
export function textSearch(docs: SearchDoc[], query: string, limit = 40): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const scored: { doc: SearchDoc; rank: number }[] = [];
  for (const doc of docs) {
    const title = norm(doc.title);
    const body = norm(doc.text);
    const tags = doc.tags.map(norm);
    let rank = 0;
    let all = true;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const inTag = tags.some((tg) => tg.includes(t));
      const inBody = body.includes(t);
      if (!inTitle && !inTag && !inBody) {
        all = false;
        break;
      }
      rank += (inTitle ? 3 : 0) + (inTag ? 2 : 0) + (inBody ? 1 : 0);
    }
    if (all) scored.push({ doc, rank });
  }
  scored.sort((a, b) => b.rank - a.rank);
  return scored.slice(0, limit).map(({ doc }) => toHit(doc, terms));
}

/** Exact-ish tag match (case-insensitive, substring so "js" finds "nextjs"). */
export function tagSearch(docs: SearchDoc[], tag: string, limit = 60): SearchHit[] {
  const t = norm(tag.replace(/^#/, "").trim());
  if (!t) return [];
  return docs
    .filter((d) => d.tags.some((x) => norm(x).includes(t)))
    .slice(0, limit)
    .map((d) => toHit(d));
}

/** All distinct tags across the corpus, most-common first. */
export function tagCloud(docs: SearchDoc[], limit = 24): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const d of docs)
    for (const raw of d.tags) {
      const t = raw.trim();
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Re-rank by a parallel array of cosine similarities (from @ternlight/base in
 * the caller). Keeps only hits above `floor`.
 */
export function rankBySimilarity(
  docs: SearchDoc[],
  sims: number[],
  { limit = 20, floor = 0.15 }: { limit?: number; floor?: number } = {}
): SearchHit[] {
  return docs
    .map((doc, i) => ({ doc, sim: sims[i] ?? 0 }))
    .filter((x) => x.sim >= floor)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(({ doc, sim }) => toHit(doc, [], Math.round(sim * 100) / 100));
}

/** The text a doc contributes to embedding / LLM context. */
export function docBlob(doc: SearchDoc): string {
  const head = [doc.title, doc.tags.length ? `[${doc.tags.join(", ")}]` : ""]
    .filter(Boolean)
    .join(" ");
  return `${head}\n${doc.text}`.trim();
}
