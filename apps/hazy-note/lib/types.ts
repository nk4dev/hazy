// Domain model for hazy note. Mirrors the 7 sections of the design doc.

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
  tone: "accent" | "neutral";
  count: number;
}

export interface Tag {
  id: string;
  label: string;
  tone: "accent" | "neutral";
  count: number;
}

export type NoteStatus = "draft" | "done";

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

export interface NoteSourceRef {
  n: number;
  label: string;
  cited: boolean;
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
  blocks: NoteBlock[];
  sources: NoteSourceRef[];
  links: NoteLink[];
  flags: { icon: string; tone: string; text: string }[];
}

export interface CompareAxis {
  name: string;
  values: (string | null)[];
  accentCols: number[]; // column indices rendered in accent (the disagreements)
}

export interface CompareBoard {
  id: string;
  projectId: string;
  sources: string[];
  axes: CompareAxis[];
  summary: string;
  candidateAxes: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "note" | "tag" | "source";
  x: number;
  y: number;
  r: number;
  focus?: boolean;
  unreadLabel?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "citation" | "hypothesis";
  reason?: string;
  title?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isolated: string[];
}

export interface Digest {
  unsorted: number;
  message: string;
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
