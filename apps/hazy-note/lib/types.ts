// Domain model for hazy note. Mirrors the 7 sections of the design doc.

import type { DeltaOp } from "@repo/db";

export type SourceKind = "article" | "pdf" | "video" | "thread" | "note";
export type ItemStatus = "reading" | "ready";

export interface Item {
  id: string;
  url: string;
  kind: SourceKind;
  site: string;
  title: string;
  addedAt: string; // ISO
  addedLabel: string; // "2分前" etc. (precomputed for the mock)
  status: ItemStatus;
  durationLabel?: string; // "42分", "PDF · 28p"
  summary: string[]; // 3行の要約
  points: string[]; // 抽出した論点
  suggestedTags: string[];
  tags: string[];
  projectId: string | null;
  quoteCandidates: number;
  relatedNoteId?: string;
}

export interface Project {
  id: string;
  name: string;
  /** The idea being developed in this project — free text. */
  description: string | null;
  tone: "accent" | "neutral";
  /** Number of sources filed under it. */
  count: number;
}

export interface ProjectNoteRef {
  id: string;
  title: string;
  status: NoteStatus;
  updatedLabel: string;
}

/** GET /api/projects/:id — the project workspace. */
export interface ProjectDetail extends Project {
  sources: Item[];
  notes: ProjectNoteRef[];
}

export interface Tag {
  id: string;
  label: string;
  tone: "accent" | "neutral";
  count: number;
}

export type NoteStatus = "draft" | "done";

/**
 * Legacy hand-rolled block model. New notes store a Quill Delta in `Note.body`;
 * this type only survives for `legacyBlocksToDelta` (lib/note-delta.ts).
 */
export type NoteBlock =
  | { type: "p"; text: string; refs?: string }
  | { type: "quote"; text: string; cite: string; note?: string }
  | { type: "highlight"; before: string; mark: string; after: string }
  | {
      type: "suggestion";
      kind: string; // "抜けている反論 — 段落の下書き"
      text: string;
      ref?: string;
    };

/** An AI-drafted suggestion, shown in the note's right sidebar. */
export interface NoteSuggestion {
  id: string;
  kind: string;
  text: string;
  ref?: string;
}

export interface NoteSourceRef {
  n: number;
  label: string;
  cited: boolean;
  url?: string;
}

export interface NoteLink {
  noteId: string;
  title: string;
  reason: string;
}

export interface Note {
  id: string;
  title: string;
  projectId: string;
  tags: { label: string; tone: "accent" | "neutral" | "outline" }[];
  status: NoteStatus;
  updatedLabel: string;
  /** The note body as a Quill Delta (`ops` array). */
  body: DeltaOp[];
  suggestions: NoteSuggestion[];
  sources: NoteSourceRef[];
  links: NoteLink[];
  flags: { icon: string; tone: string; text: string }[];
}

// ── 検索（/search） ─────────────────────────────────────────

export type SearchMode = "text" | "tag" | "ai" | "chat";

/** One row of the flat, mixed notes+sources result list. */
export interface SearchHit {
  id: string;
  /** "note" or one of the source kinds. */
  kind: SourceKind;
  title: string;
  /** A one-line context snippet (body excerpt / summary). */
  snippet: string;
  tags: string[];
  /** Where to go — `/notes/:id` or the external URL. */
  href: string;
  external: boolean;
  /** 0–1, only set by AI mode. */
  score?: number;
}

/** POST /api/search/chat — a conversational lookup over the user's own library. */
export interface SearchChatAnswer {
  answer: string;
  /** The notes / sources the answer drew on. */
  sources: SearchHit[];
  /** false when the LLM was unavailable and this is a plain keyword fallback. */
  llm: boolean;
}

// ── 傾向分析（/analyze） ─────────────────────────────────────

/** The deterministic aggregation over a user's notes + saved URLs. */
export interface InsightStats {
  noteCount: number;
  noteCharTotal: number;
  noteCharAvg: number;
  notesLast30d: number;
  urlCount: number;
  /** URLs whose fetch succeeded (i.e. actually read / extracted). */
  urlReadCount: number;
  topDomains: { domain: string; count: number }[];
  kindMix: { kind: SourceKind; count: number }[];
  /** `notes.tags[].label` + `savedUrls.tags[]`, normalised and merged. */
  topTags: { label: string; count: number }[];
  languageMix: { lang: string; count: number }[];
  span: { firstLabel: string; lastLabel: string } | null;
}

export interface InsightTheme {
  label: string;
  /** 1–5, rough salience. */
  weight: number;
  /** One line of evidence / nuance. */
  note: string;
}

/** GET/POST /api/analyze — a cached tendency read for the account or one project. */
export interface InsightProfile {
  projectId: string; // "" = whole account
  generatedLabel: string; // "分析 · 3分前"
  /** false when the LLM was unavailable and only the aggregation ran. */
  llm: boolean;
  stats: InsightStats;
  profile: string;
  themes: InsightTheme[];
  leanings: string[];
  blindSpots: string[];
  nextSteps: string[];
}

export type ExportFormat = "blog" | "memo" | "bullets";

export interface ExportSectionProvenance {
  heading: string;
  from: string;
  tone: "accent" | "muted";
}

export interface ExportDraft {
  format: ExportFormat;
  meta: string; // "約1,800字 · 読了6分"
  title: string;
  blocks: (
    | { type: "p"; text: string; dim?: boolean }
    | { type: "h4"; text: string }
    | { type: "note"; tone: string; text: string }
  )[];
  provenance: ExportSectionProvenance[];
  warning?: string;
}
