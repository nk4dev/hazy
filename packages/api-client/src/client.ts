import type {
  AskResponseDTO,
  AskThreadDetailDTO,
  AskThreadListDTO,
  CollectionDTO,
  CollectionDetailDTO,
  CollectionItemRefDTO,
  CollectionSummaryDTO,
  ConnectCodeDTO,
  ConnectedAppDTO,
  ItemCollectionsDTO,
  MeDTO,
  NoteDTO,
  NoteExportDraftDTO,
  NoteExportFormat,
  NoteExportResultDTO,
  NoteInsightProfileDTO,
  NoteItemDTO,
  NoteProjectDTO,
  NoteProjectDetailDTO,
  NoteSearchChatAnswerDTO,
  NoteSearchChatTurnDTO,
  NoteSourceRefDTO,
  NoteStatus,
  NoteSuggestionDTO,
  NoteTagBadgeDTO,
  NoteTagDTO,
  PaginatedResponse,
  ReadLaterQueueDTO,
  ReadLaterStateDTO,
  ReadLaterStatsDTO,
  ReadLaterStatus,
  SavedUrlDTO,
  SearchResponseDTO,
} from "./types";

/** Thrown for every non-2xx response and every `{ error }` envelope. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface HazyClientConfig {
  /** e.g. `https://api.hz.nknighta.me` (no trailing `/v1`). */
  baseUrl: string;
  /** Resolves the current Clerk session token, or null when signed out. */
  getToken: () => Promise<string | null>;
}

type RequestInitLite = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

type Envelope<T> =
  | { data: T }
  | { error: { code: string; message: string; details?: unknown } };

/** Fetches a binary response (image download) rather than the `{ data }` JSON envelope. */
function createBinaryRequest(config: HazyClientConfig) {
  return async function requestBinary(
    path: string
  ): Promise<{ blob: Blob; contentType: string }> {
    const url = new URL(`/v1${path}`, config.baseUrl);
    const token = await config.getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as Envelope<never> | null;
      if (json && "error" in json) {
        throw new ApiClientError(
          json.error.code,
          json.error.message,
          res.status,
          json.error.details
        );
      }
      throw new ApiClientError("internal_error", `Request failed (${res.status})`, res.status);
    }
    const blob = await res.blob();
    return { blob, contentType: res.headers.get("content-type") ?? blob.type };
  };
}

function createRequest(config: HazyClientConfig) {
  return async function request<T>(path: string, init: RequestInitLite = {}): Promise<T> {
    const url = new URL(`/v1${path}`, config.baseUrl);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const token = await config.getToken();
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });

    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (json && "error" in json) {
      throw new ApiClientError(json.error.code, json.error.message, res.status, json.error.details);
    }
    if (!res.ok || !json || !("data" in json)) {
      throw new ApiClientError("internal_error", `Request failed (${res.status})`, res.status);
    }
    return json.data;
  };
}

export interface ItemPatch {
  title?: string | null;
  domain?: string | null;
  summary?: string | null;
  tags?: string[];
}

export interface CollectionPatch {
  name?: string;
  description?: string | null;
  color?: string | null;
}

export interface AskInput {
  question: string;
  answerLanguageOverride?: "en" | "ja";
  collectionIds?: string[];
}

export interface ConnectAuthorizeInput {
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface NoteItemPatch {
  tags?: string[];
  projectId?: string | null;
  title?: string;
  summary?: string[];
}

export interface NoteCreateInput {
  title?: string;
  projectId?: string;
  text?: string;
  body?: NoteDTO["body"];
  suggestions?: NoteSuggestionDTO[];
  tags?: NoteTagBadgeDTO[];
  status?: NoteStatus;
  sources?: NoteSourceRefDTO[];
}

export interface NotePatch {
  title?: string;
  status?: NoteStatus;
  projectId?: string | null;
  body?: NoteDTO["body"];
  suggestions?: NoteSuggestionDTO[];
  tags?: NoteTagBadgeDTO[];
  sources?: NoteSourceRefDTO[];
}

export interface NoteProjectCreateInput {
  name: string;
  description?: string;
  tone?: "accent" | "neutral";
}

export interface NoteProjectPatch {
  name?: string;
  description?: string | null;
  tone?: "accent" | "neutral";
}

export function createHazyClient(config: HazyClientConfig) {
  const request = createRequest(config);
  const requestBinary = createBinaryRequest(config);

  return {
    items: {
      list: (
        query: { sort?: "newest" | "oldest"; cursor?: string; limit?: number } = {},
        signal?: AbortSignal
      ) => request<PaginatedResponse<SavedUrlDTO>>("/items", { query, signal }),
      save: (url: string, options?: { collectionIds?: string[] }) =>
        request<SavedUrlDTO>("/items", {
          method: "POST",
          body:
            options?.collectionIds && options.collectionIds.length > 0
              ? { url, collectionIds: options.collectionIds }
              : { url },
        }),
      get: (id: string, signal?: AbortSignal) =>
        request<SavedUrlDTO>(`/items/${id}`, { signal }),
      update: (id: string, patch: ItemPatch) =>
        request<SavedUrlDTO>(`/items/${id}`, { method: "PATCH", body: patch }),
      remove: (id: string) => request<{ id: string }>(`/items/${id}`, { method: "DELETE" }),
      refetch: (id: string) =>
        request<SavedUrlDTO>(`/items/${id}/refetch`, { method: "POST" }),
      summarize: (id: string) =>
        request<SavedUrlDTO>(`/items/${id}/summarize`, { method: "POST" }),
      setCollections: (id: string, collectionIds: string[]) =>
        request<ItemCollectionsDTO>(`/items/${id}/collections`, {
          method: "PUT",
          body: { collectionIds },
        }),
      downloadImage: (id: string) => requestBinary(`/items/${id}/image`),
    },

    collections: {
      list: () => request<{ items: CollectionDTO[] }>("/collections"),
      get: (id: string, signal?: AbortSignal) =>
        request<CollectionDetailDTO>(`/collections/${id}`, { signal }),
      create: (input: { name: string; description?: string; color?: string }) =>
        request<CollectionDTO>("/collections", { method: "POST", body: input }),
      update: (id: string, patch: CollectionPatch) =>
        request<CollectionDTO>(`/collections/${id}`, { method: "PATCH", body: patch }),
      remove: (id: string) =>
        request<{ id: string }>(`/collections/${id}`, { method: "DELETE" }),
      addItem: (collectionId: string, savedUrlId: string) =>
        request<CollectionItemRefDTO>(`/collections/${collectionId}/items`, {
          method: "POST",
          body: { savedUrlId },
        }),
      removeItem: (collectionId: string, savedUrlId: string) =>
        request<CollectionItemRefDTO>(`/collections/${collectionId}/items/${savedUrlId}`, {
          method: "DELETE",
        }),
      summarize: (id: string, locale?: "en" | "ja") =>
        request<CollectionSummaryDTO>(`/collections/${id}/summarize`, {
          method: "POST",
          body: { locale },
        }),
    },

    ask: {
      ask: (input: AskInput) => request<AskResponseDTO>("/ask", { method: "POST", body: input }),
      threads: () => request<AskThreadListDTO>("/ask/threads"),
      thread: (id: string, signal?: AbortSignal) =>
        request<AskThreadDetailDTO>(`/ask/threads/${id}`, { signal }),
      deleteThread: (id: string) =>
        request<{ id: string }>(`/ask/threads/${id}`, { method: "DELETE" }),
      followUp: (threadId: string, input: AskInput) =>
        request<AskResponseDTO>(`/ask/threads/${threadId}/messages`, {
          method: "POST",
          body: input,
        }),
    },

    readLater: {
      queue: () => request<ReadLaterQueueDTO>("/read-later"),
      stats: () => request<ReadLaterStatsDTO>("/read-later/stats"),
      setStatus: (input: {
        itemId: string;
        status: ReadLaterStatus;
        snoozedUntil?: string;
      }) =>
        request<ReadLaterStateDTO>(`/read-later/${input.itemId}`, {
          method: "PATCH",
          body: { status: input.status, snoozedUntil: input.snoozedUntil },
        }),
    },

    search: (q: string, limit?: number, signal?: AbortSignal) =>
      request<SearchResponseDTO>("/search", { query: { q, limit }, signal }),

    me: {
      get: () => request<MeDTO>("/me"),
      updatePreferences: (patch: Partial<MeDTO["preferences"]>) =>
        request<MeDTO["preferences"]>("/me", { method: "PATCH", body: patch }),
    },

    // "Connect with Hazy" — needs a Clerk session (a connected app's own
    // `hz_…` token gets 403 here). The code → token exchange is the public
    // `POST /v1/connect/token`, called by the third-party client, not by hazy.
    connect: {
      authorize: (input: ConnectAuthorizeInput) =>
        request<ConnectCodeDTO>("/connect/authorize", { method: "POST", body: input }),
      apps: () => request<{ items: ConnectedAppDTO[] }>("/connect/apps"),
      revoke: (id: string) => request<{ id: string }>(`/connect/apps/${id}`, { method: "DELETE" }),
    },

    note: {
      items: {
        list: () => request<NoteItemDTO[]>("/note/items"),
        importable: () => request<NoteItemDTO[]>("/note/items/importable"),
        get: (id: string) => request<NoteItemDTO>(`/note/items/${id}`),
        addUrl: (url: string) => request<NoteItemDTO>("/note/items", { method: "POST", body: { url } }),
        addMemo: (text: string) =>
          request<NoteItemDTO>("/note/items", { method: "POST", body: { text } }),
        finishReading: (id: string) =>
          request<NoteItemDTO>(`/note/items/${id}/read`, { method: "POST" }),
        update: (id: string, patch: NoteItemPatch) =>
          request<NoteItemDTO>(`/note/items/${id}`, { method: "PATCH", body: patch }),
        remove: (id: string) => request<{ id: string }>(`/note/items/${id}`, { method: "DELETE" }),
      },
      notes: {
        list: () => request<NoteDTO[]>("/note/notes"),
        get: (id: string) => request<NoteDTO>(`/note/notes/${id}`),
        create: (input: NoteCreateInput = {}) =>
          request<NoteDTO>("/note/notes", { method: "POST", body: input }),
        update: (id: string, patch: NotePatch) =>
          request<NoteDTO>(`/note/notes/${id}`, { method: "PATCH", body: patch }),
        appendParagraph: (id: string, text: string) =>
          request<NoteDTO>(`/note/notes/${id}`, { method: "PATCH", body: { text } }),
        remove: (id: string) => request<{ id: string }>(`/note/notes/${id}`, { method: "DELETE" }),
        suggestion: (id: string, suggestionId: string, action: "accept" | "dismiss") =>
          request<NoteDTO>(`/note/notes/${id}/suggestion`, {
            method: "POST",
            body: { id: suggestionId, action },
          }),
      },
      projects: {
        list: () => request<NoteProjectDTO[]>("/note/projects"),
        get: (id: string) => request<NoteProjectDetailDTO>(`/note/projects/${id}`),
        create: (input: NoteProjectCreateInput) =>
          request<NoteProjectDTO>("/note/projects", { method: "POST", body: input }),
        update: (id: string, patch: NoteProjectPatch) =>
          request<NoteProjectDTO>(`/note/projects/${id}`, { method: "PATCH", body: patch }),
        remove: (id: string) =>
          request<{ id: string }>(`/note/projects/${id}`, { method: "DELETE" }),
      },
      tags: {
        list: () => request<NoteTagDTO[]>("/note/tags"),
      },
      searchChat: (query: string, history?: NoteSearchChatTurnDTO[]) =>
        request<NoteSearchChatAnswerDTO>("/note/search/chat", {
          method: "POST",
          body: { query, history },
        }),
      analyze: {
        get: (projectId?: string) =>
          request<NoteInsightProfileDTO>("/note/analyze", { query: { project: projectId } }),
        rebuild: (projectId?: string) =>
          request<NoteInsightProfileDTO>("/note/analyze", {
            method: "POST",
            body: projectId ? { projectId } : {},
          }),
      },
      export: {
        preview: (noteId: string, format: NoteExportFormat) =>
          request<NoteExportDraftDTO>("/note/export", { query: { noteId, format } }),
        run: (noteId: string, format: NoteExportFormat) =>
          request<NoteExportResultDTO>("/note/export", {
            method: "POST",
            body: { noteId, format },
          }),
      },
    },
  };
}

export type HazyClient = ReturnType<typeof createHazyClient>;
