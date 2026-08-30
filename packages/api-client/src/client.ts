import type {
  AskResponseDTO,
  AskThreadDetailDTO,
  AskThreadListDTO,
  CollectionDTO,
  CollectionDetailDTO,
  CollectionItemRefDTO,
  CollectionSummaryDTO,
  MeDTO,
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

export function createHazyClient(config: HazyClientConfig) {
  const request = createRequest(config);

  return {
    items: {
      list: (
        query: { sort?: "newest" | "oldest"; cursor?: string; limit?: number } = {},
        signal?: AbortSignal
      ) => request<PaginatedResponse<SavedUrlDTO>>("/items", { query, signal }),
      save: (url: string) => request<SavedUrlDTO>("/items", { method: "POST", body: { url } }),
      get: (id: string, signal?: AbortSignal) =>
        request<SavedUrlDTO>(`/items/${id}`, { signal }),
      update: (id: string, patch: ItemPatch) =>
        request<SavedUrlDTO>(`/items/${id}`, { method: "PATCH", body: patch }),
      remove: (id: string) => request<{ id: string }>(`/items/${id}`, { method: "DELETE" }),
      refetch: (id: string) =>
        request<SavedUrlDTO>(`/items/${id}/refetch`, { method: "POST" }),
      summarize: (id: string) =>
        request<SavedUrlDTO>(`/items/${id}/summarize`, { method: "POST" }),
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
  };
}

export type HazyClient = ReturnType<typeof createHazyClient>;
