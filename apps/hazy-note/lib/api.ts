import { noteApiClient } from "./clients";
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

export const api = {
  items: (): Promise<Item[]> => noteApiClient.note.items.list(),
  importable: (): Promise<Item[]> => noteApiClient.note.items.importable(),
  item: (id: string): Promise<Item> => noteApiClient.note.items.get(id),
  addItem: (url: string): Promise<Item> => noteApiClient.note.items.addUrl(url),
  addMemo: (text: string): Promise<Item> => noteApiClient.note.items.addMemo(text),
  finishReading: (id: string): Promise<Item> => noteApiClient.note.items.finishReading(id),
  updateItem: (id: string, patch: Partial<Item>): Promise<Item> =>
    noteApiClient.note.items.update(id, {
      tags: patch.tags,
      projectId: patch.projectId,
      title: patch.title,
      summary: patch.summary,
    }),
  deleteItem: (id: string) => noteApiClient.note.items.remove(id).then(() => ({ ok: true })),

  projects: (): Promise<Project[]> => noteApiClient.note.projects.list(),
  project: (id: string): Promise<ProjectDetail> => noteApiClient.note.projects.get(id),
  addProject: (
    name: string,
    patch: { description?: string; tone?: "accent" | "neutral" } = {}
  ): Promise<Project> => noteApiClient.note.projects.create({ name, ...patch }),
  updateProject: (
    id: string,
    patch: { name?: string; description?: string | null; tone?: "accent" | "neutral" }
  ): Promise<Project> => noteApiClient.note.projects.update(id, patch),
  deleteProject: (id: string) =>
    noteApiClient.note.projects.remove(id).then(() => ({ ok: true })),
  tags: (): Promise<Tag[]> => noteApiClient.note.tags.list(),

  notes: (): Promise<Note[]> => noteApiClient.note.notes.list(),
  note: (id: string): Promise<Note> => noteApiClient.note.notes.get(id),
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
  ): Promise<Note> => noteApiClient.note.notes.create(input),
  updateNote: (id: string, patch: Partial<Note>): Promise<Note> =>
    noteApiClient.note.notes.update(id, {
      title: patch.title,
      status: patch.status,
      projectId: patch.projectId,
      body: patch.body,
      suggestions: patch.suggestions,
      tags: patch.tags,
      sources: patch.sources,
    }),
  deleteNote: (id: string) => noteApiClient.note.notes.remove(id).then(() => ({ ok: true })),
  appendParagraph: (id: string, text: string): Promise<Note> =>
    noteApiClient.note.notes.appendParagraph(id, text),
  suggestion: (id: string, suggestionId: string, action: "accept" | "dismiss"): Promise<Note> =>
    noteApiClient.note.notes.suggestion(id, suggestionId, action),

  analyze: (projectId?: string): Promise<InsightProfile> =>
    noteApiClient.note.analyze.get(projectId),
  rebuildAnalyze: (projectId?: string): Promise<InsightProfile> =>
    noteApiClient.note.analyze.rebuild(projectId),

  searchChat: (
    query: string,
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<SearchChatAnswer> => noteApiClient.note.searchChat(query, history),

  export: (noteId: string, format: ExportFormat): Promise<ExportDraft> =>
    noteApiClient.note.export.preview(noteId, format),
  runExport: (noteId: string, format: ExportFormat) =>
    noteApiClient.note.export.run(noteId, format),
};
