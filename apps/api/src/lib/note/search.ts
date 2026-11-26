import type { NoteDTO, NoteItemDTO, NoteSearchHitDTO, NoteSourceKind } from "@/types/api";
import { deltaToPlainText } from "./delta";

export interface SearchDoc {
  id: string;
  kind: NoteSourceKind;
  title: string;
  text: string;
  tags: string[];
  href: string;
  external: boolean;
}

const norm = (s: string): string => s.toLowerCase().normalize("NFKC");

export function noteToDoc(n: NoteDTO): SearchDoc {
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

export function itemToDoc(it: NoteItemDTO): SearchDoc {
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

export function buildCorpus(notes: NoteDTO[], items: NoteItemDTO[]): SearchDoc[] {
  return [...notes.map(noteToDoc), ...items.filter((it) => it.kind !== "note").map(itemToDoc)];
}

export function queryTerms(q: string): string[] {
  const terms: string[] = [];
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = (m[1] ?? m[2] ?? "").trim();
    if (t) terms.push(norm(t));
  }
  return terms;
}

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

export function toHit(doc: SearchDoc, terms: string[] = [], score?: number): NoteSearchHitDTO {
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

export function textSearch(docs: SearchDoc[], query: string, limit = 40): NoteSearchHitDTO[] {
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
