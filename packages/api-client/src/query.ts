import {
  infiniteQueryOptions,
  MutationCache,
  QueryCache,
  QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { fetchAuthSession, type HazyAuthClient } from "./auth";
import { ApiClientError, type HazyClient } from "./client";
import type { NoteExportFormat } from "./types";

export const QUERY_STALE_TIMES = {
  session: 60_000,
  reference: 5 * 60_000,
  list: 45_000,
  detail: 60_000,
  search: 20_000,
} as const;

export const QUERY_GC_TIME = 15 * 60_000;

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiClientError &&
    (error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 422)
  ) {
    return false;
  }
  return failureCount < 1;
}

export function createAppQueryClient(
  options: {
    onUnauthorized?: () => void;
    refetchOnWindowFocus?: boolean;
  } = {}
): QueryClient {
  let handlingUnauthorized = false;
  const handleError = (error: unknown) => {
    if (!isUnauthorizedError(error) || handlingUnauthorized) return;
    handlingUnauthorized = true;
    queueMicrotask(() => {
      handlingUnauthorized = false;
    });
    options.onUnauthorized?.();
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
      },
    },
  });
}

export const hazyQueryKeys = {
  auth: {
    all: ["auth"] as const,
    session: () => ["auth", "session"] as const,
    config: () => ["auth", "config"] as const,
    passkeys: () => ["auth", "passkeys"] as const,
  },
  me: () => ["me"] as const,
  items: {
    all: ["items"] as const,
    list: (sort: "newest" | "oldest" = "newest") => ["items", sort] as const,
    recent: (limit: number) => ["items", "recent", limit] as const,
    detail: (id: string) => ["item", id] as const,
  },
  collections: {
    all: ["collections"] as const,
    detail: (id: string) => ["collections", id] as const,
  },
  ask: {
    all: ["ask"] as const,
    threads: () => ["ask", "threads"] as const,
    thread: (id: string) => ["ask", "threads", id] as const,
  },
  readLater: {
    all: ["read-later"] as const,
    queue: () => ["read-later"] as const,
    stats: () => ["read-later", "stats"] as const,
  },
  search: (query: string) => ["search", query] as const,
  connect: {
    apps: () => ["connected-apps"] as const,
  },
  note: {
    all: ["note"] as const,
    items: () => ["note", "items"] as const,
    importableItems: () => ["note", "items", "importable"] as const,
    item: (id: string) => ["note", "item", id] as const,
    notes: () => ["note", "notes"] as const,
    note: (id: string) => ["note", "note", id] as const,
    projects: () => ["note", "projects"] as const,
    project: (id: string) => ["note", "project", id] as const,
    tags: () => ["note", "tags"] as const,
    analyze: (projectId?: string) => ["note", "analyze", projectId ?? "all"] as const,
    exportPreview: (noteId: string, format: NoteExportFormat) =>
      ["note", "export", noteId, format] as const,
  },
} as const;

export function authSessionQueryOptions(authClient: HazyAuthClient) {
  return queryOptions({
    queryKey: hazyQueryKeys.auth.session(),
    queryFn: () => fetchAuthSession(authClient),
    staleTime: QUERY_STALE_TIMES.session,
    gcTime: QUERY_GC_TIME,
  });
}

export function createHazyQueryOptions(client: HazyClient) {
  return {
    authConfig: () =>
      queryOptions({
        queryKey: hazyQueryKeys.auth.config(),
        queryFn: ({ signal }) => client.authConfig(signal),
        staleTime: QUERY_STALE_TIMES.reference,
        gcTime: QUERY_GC_TIME,
      }),

    me: () =>
      queryOptions({
        queryKey: hazyQueryKeys.me(),
        queryFn: ({ signal }) => client.me.get(signal),
        staleTime: QUERY_STALE_TIMES.reference,
        gcTime: QUERY_GC_TIME,
      }),

    itemsInfinite: (sort: "newest" | "oldest" = "newest") =>
      infiniteQueryOptions({
        queryKey: hazyQueryKeys.items.list(sort),
        queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
          client.items.list({ sort, cursor: pageParam }, signal),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    itemsRecent: (limit = 6) =>
      queryOptions({
        queryKey: hazyQueryKeys.items.recent(limit),
        queryFn: ({ signal }) => client.items.list({ sort: "newest", limit }, signal),
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    item: (id: string) =>
      queryOptions({
        queryKey: hazyQueryKeys.items.detail(id),
        queryFn: ({ signal }) => client.items.get(id, signal),
        enabled: Boolean(id),
        staleTime: QUERY_STALE_TIMES.detail,
        gcTime: QUERY_GC_TIME,
      }),

    collections: () =>
      queryOptions({
        queryKey: hazyQueryKeys.collections.all,
        queryFn: ({ signal }) => client.collections.list(signal),
        staleTime: QUERY_STALE_TIMES.reference,
        gcTime: QUERY_GC_TIME,
      }),

    collection: (id: string) =>
      queryOptions({
        queryKey: hazyQueryKeys.collections.detail(id),
        queryFn: ({ signal }) => client.collections.get(id, signal),
        enabled: Boolean(id),
        staleTime: QUERY_STALE_TIMES.detail,
        gcTime: QUERY_GC_TIME,
      }),

    askThreads: () =>
      queryOptions({
        queryKey: hazyQueryKeys.ask.threads(),
        queryFn: ({ signal }) => client.ask.threads(signal),
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    askThread: (id: string | null) =>
      queryOptions({
        queryKey: hazyQueryKeys.ask.thread(id ?? ""),
        queryFn: ({ signal }) => client.ask.thread(id as string, signal),
        enabled: Boolean(id),
        staleTime: QUERY_STALE_TIMES.detail,
        gcTime: QUERY_GC_TIME,
      }),

    readLaterQueue: () =>
      queryOptions({
        queryKey: hazyQueryKeys.readLater.queue(),
        queryFn: ({ signal }) => client.readLater.queue(signal),
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    readLaterStats: () =>
      queryOptions({
        queryKey: hazyQueryKeys.readLater.stats(),
        queryFn: ({ signal }) => client.readLater.stats(signal),
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    search: (query: string) => {
      const trimmed = query.trim();
      return queryOptions({
        queryKey: hazyQueryKeys.search(trimmed),
        queryFn: ({ signal }) => client.search(trimmed, undefined, signal),
        enabled: trimmed.length > 0,
        staleTime: QUERY_STALE_TIMES.search,
        gcTime: QUERY_GC_TIME,
      });
    },

    connectedApps: () =>
      queryOptions({
        queryKey: hazyQueryKeys.connect.apps(),
        queryFn: ({ signal }) => client.connect.apps(signal),
        staleTime: QUERY_STALE_TIMES.list,
        gcTime: QUERY_GC_TIME,
      }),

    note: {
      items: () =>
        queryOptions({
          queryKey: hazyQueryKeys.note.items(),
          queryFn: ({ signal }) => client.note.items.list(signal),
          staleTime: QUERY_STALE_TIMES.list,
          gcTime: QUERY_GC_TIME,
        }),

      importableItems: () =>
        queryOptions({
          queryKey: hazyQueryKeys.note.importableItems(),
          queryFn: ({ signal }) => client.note.items.importable(signal),
          staleTime: QUERY_STALE_TIMES.list,
          gcTime: QUERY_GC_TIME,
        }),

      item: (id: string) =>
        queryOptions({
          queryKey: hazyQueryKeys.note.item(id),
          queryFn: ({ signal }) => client.note.items.get(id, signal),
          enabled: Boolean(id),
          staleTime: QUERY_STALE_TIMES.detail,
          gcTime: QUERY_GC_TIME,
        }),

      notes: () =>
        queryOptions({
          queryKey: hazyQueryKeys.note.notes(),
          queryFn: ({ signal }) => client.note.notes.list(signal),
          staleTime: QUERY_STALE_TIMES.list,
          gcTime: QUERY_GC_TIME,
        }),

      note: (id: string) =>
        queryOptions({
          queryKey: hazyQueryKeys.note.note(id),
          queryFn: ({ signal }) => client.note.notes.get(id, signal),
          enabled: Boolean(id),
          staleTime: QUERY_STALE_TIMES.detail,
          gcTime: QUERY_GC_TIME,
        }),

      projects: () =>
        queryOptions({
          queryKey: hazyQueryKeys.note.projects(),
          queryFn: ({ signal }) => client.note.projects.list(signal),
          staleTime: QUERY_STALE_TIMES.reference,
          gcTime: QUERY_GC_TIME,
        }),

      project: (id: string) =>
        queryOptions({
          queryKey: hazyQueryKeys.note.project(id),
          queryFn: ({ signal }) => client.note.projects.get(id, signal),
          enabled: Boolean(id),
          staleTime: QUERY_STALE_TIMES.detail,
          gcTime: QUERY_GC_TIME,
        }),

      tags: () =>
        queryOptions({
          queryKey: hazyQueryKeys.note.tags(),
          queryFn: ({ signal }) => client.note.tags.list(signal),
          staleTime: QUERY_STALE_TIMES.reference,
          gcTime: QUERY_GC_TIME,
        }),

      analyze: (projectId?: string) =>
        queryOptions({
          queryKey: hazyQueryKeys.note.analyze(projectId),
          queryFn: ({ signal }) => client.note.analyze.get(projectId, signal),
          staleTime: QUERY_STALE_TIMES.detail,
          gcTime: QUERY_GC_TIME,
        }),

      exportPreview: (noteId: string, format: NoteExportFormat) =>
        queryOptions({
          queryKey: hazyQueryKeys.note.exportPreview(noteId, format),
          queryFn: ({ signal }) => client.note.export.preview(noteId, format, signal),
          enabled: Boolean(noteId),
          staleTime: QUERY_STALE_TIMES.detail,
          gcTime: QUERY_GC_TIME,
        }),
    },
  };
}
