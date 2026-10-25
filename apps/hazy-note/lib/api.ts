import type {
  ExportDraft,
  ExportFormat,
  InsightProfile,
  Item,
  Note,
  Project,
  ProjectDetail,
  SearchChatAnswer,
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
  items: () => fetch("/api/items", { cache: "no-store" }).then(j<Item[]>),
  importable: () => fetch("/api/items/importable", { cache: "no-store" }).then(j<Item[]>),
  item: (id: string) => fetch(`/api/items/${id}`, { cache: "no-store" }).then(j<Item>),
  addItem: (url: string) => fetch("/api/items", opts("POST", { url })).then(j<Item>),
  addMemo: (text: string) => fetch("/api/items", opts("POST", { text })).then(j<Item>),
  finishReading: (id: string) => fetch(`/api/items/${id}/read`, opts("POST")).then(j<Item>),
  updateItem: (id: string, patch: Partial<Item>) =>
    fetch(`/api/items/${id}`, opts("PATCH", patch)).then(j<Item>),
  deleteItem: (id: string) => fetch(`/api/items/${id}`, opts("DELETE")).then(j<{ ok: boolean }>),

  projects: () => fetch("/api/projects", { cache: "no-store" }).then(j<Project[]>),
  project: (id: string) =>
    fetch(`/api/projects/${id}`, { cache: "no-store" }).then(j<ProjectDetail>),
  addProject: (name: string, patch: { description?: string; tone?: "accent" | "neutral" } = {}) =>
    fetch("/api/projects", opts("POST", { name, ...patch })).then(j<Project>),
  updateProject: (
    id: string,
    patch: { name?: string; description?: string | null; tone?: "accent" | "neutral" }
  ) => fetch(`/api/projects/${id}`, opts("PATCH", patch)).then(j<Project>),
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
    } = {}
  ) => fetch("/api/notes", opts("POST", input)).then(j<Note>),
  updateNote: (id: string, patch: Partial<Note>) =>
    fetch(`/api/notes/${id}`, opts("PATCH", patch)).then(j<Note>),
  deleteNote: (id: string) => fetch(`/api/notes/${id}`, opts("DELETE")).then(j<{ ok: boolean }>),
  appendParagraph: (id: string, text: string) =>
    fetch(`/api/notes/${id}`, opts("PATCH", { text })).then(j<Note>),
  suggestion: (id: string, suggestionId: string, action: "accept" | "dismiss") =>
    fetch(`/api/notes/${id}/suggestion`, opts("POST", { id: suggestionId, action })).then(j<Note>),

  analyze: (projectId?: string) =>
    fetch(`/api/analyze${projectId ? `?project=${projectId}` : ""}`, { cache: "no-store" }).then(
      j<InsightProfile>
    ),
  rebuildAnalyze: (projectId?: string) =>
    fetch("/api/analyze", opts("POST", projectId ? { projectId } : {})).then(j<InsightProfile>),

  searchChat: (query: string, history?: { role: "user" | "assistant"; content: string }[]) =>
    fetch("/api/search/chat", opts("POST", { query, history })).then(j<SearchChatAnswer>),

  export: (noteId: string, format: ExportFormat) =>
    fetch(`/api/export?noteId=${noteId}&format=${format}`, {
      cache: "no-store",
    }).then(j<ExportDraft>),
  runExport: (noteId: string, format: ExportFormat) =>
    fetch("/api/export", opts("POST", { noteId, format })).then(
      j<ExportDraft & { exportedTo: string }>
    ),
};
