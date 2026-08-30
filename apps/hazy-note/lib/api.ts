import type {
  CompareBoard,
  Digest,
  ExportDraft,
  ExportFormat,
  GraphData,
  Item,
  Note,
  Project,
  Tag,
} from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const opts = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body !== undefined ? { "content-type": "application/json" } : undefined,
  body: body !== undefined ? JSON.stringify(body) : undefined,
  cache: "no-store",
});

export const api = {
  digest: () => fetch("/api/digest", { cache: "no-store" }).then(j<Digest>),

  items: () => fetch("/api/items", { cache: "no-store" }).then(j<Item[]>),
  importable: () => fetch("/api/items/importable", { cache: "no-store" }).then(j<Item[]>),
  item: (id: string) => fetch(`/api/items/${id}`, { cache: "no-store" }).then(j<Item>),
  addItem: (url: string) => fetch("/api/items", opts("POST", { url })).then(j<Item>),
  addMemo: (text: string) => fetch("/api/items", opts("POST", { text })).then(j<Item>),
  finishReading: (id: string) => fetch(`/api/items/${id}/read`, opts("POST")).then(j<Item>),
  updateItem: (id: string, patch: Partial<Item>) =>
    fetch(`/api/items/${id}`, opts("PATCH", patch)).then(j<Item>),
  deleteItem: (id: string) => fetch(`/api/items/${id}`, opts("DELETE")).then(j<{ ok: boolean }>),
  autoSort: () => fetch("/api/items/sort", opts("POST")).then(j<{ moved: number }>),

  projects: () => fetch("/api/projects", { cache: "no-store" }).then(j<Project[]>),
  addProject: (name: string, tone: "accent" | "neutral" = "neutral") =>
    fetch("/api/projects", opts("POST", { name, tone })).then(j<Project>),
  updateProject: (id: string, patch: { name?: string; tone?: "accent" | "neutral" }) =>
    fetch(`/api/projects/${id}`, opts("PATCH", patch)).then(j<Project>),
  deleteProject: (id: string) =>
    fetch(`/api/projects/${id}`, opts("DELETE")).then(j<{ ok: boolean }>),
  tags: () => fetch("/api/tags", { cache: "no-store" }).then(j<Tag[]>),

  notes: () => fetch("/api/notes", { cache: "no-store" }).then(j<Note[]>),
  note: (id: string) => fetch(`/api/notes/${id}`, { cache: "no-store" }).then(j<Note>),
  addNote: (
    input: {
      title?: string;
      projectId?: string;
      text?: string;
      body?: Note["body"];
      suggestions?: Note["suggestions"];
      tags?: Note["tags"];
      status?: Note["status"];
      sources?: Note["sources"];
    } = {},
  ) => fetch("/api/notes", opts("POST", input)).then(j<Note>),
  updateNote: (id: string, patch: Partial<Note>) =>
    fetch(`/api/notes/${id}`, opts("PATCH", patch)).then(j<Note>),
  deleteNote: (id: string) => fetch(`/api/notes/${id}`, opts("DELETE")).then(j<{ ok: boolean }>),
  appendParagraph: (id: string, text: string) =>
    fetch(`/api/notes/${id}`, opts("PATCH", { text })).then(j<Note>),
  suggestion: (id: string, suggestionId: string, action: "accept" | "dismiss") =>
    fetch(`/api/notes/${id}/suggestion`, opts("POST", { id: suggestionId, action })).then(j<Note>),

  compare: () => fetch("/api/compare", { cache: "no-store" }).then(j<CompareBoard>),
  rebuildCompare: (projectId?: string) =>
    fetch("/api/compare", opts("POST", projectId ? { projectId } : {})).then(j<CompareBoard>),

  graph: () => fetch("/api/graph", { cache: "no-store" }).then(j<GraphData>),
  rebuildGraph: () => fetch("/api/graph", opts("POST")).then(j<GraphData>),

  export: (noteId: string, format: ExportFormat) =>
    fetch(`/api/export?noteId=${noteId}&format=${format}`, {
      cache: "no-store",
    }).then(j<ExportDraft>),
  runExport: (noteId: string, format: ExportFormat) =>
    fetch("/api/export", opts("POST", { noteId, format })).then(
      j<ExportDraft & { exportedTo: string }>
    ),
};
