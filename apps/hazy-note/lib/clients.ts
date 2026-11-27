import { createHazyClient } from "@repo/api-client";
import { createHazyAuthClient } from "@repo/api-client/auth";
import {
  authSessionQueryOptions,
  createAppQueryClient,
  createHazyQueryOptions,
} from "@repo/api-client/query";
import { env } from "./env";

let onUnauthorizedHandler: (() => void) | null = null;

export function setNoteUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorizedHandler = handler;
}

/** Allow only same-origin relative paths (never protocol-relative `//`) for post-login redirects. */
export function sanitizeRedirectUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

/** Splits a relative `/path?a=b` URL into TanStack Router `to` + `search` options. */
export function splitPathAndSearch(href: string): {
  to: string;
  search?: Record<string, string>;
} {
  const idx = href.indexOf("?");
  if (idx === -1) return { to: href || "/" };
  const to = href.slice(0, idx) || "/";
  const params = new URLSearchParams(href.slice(idx + 1));
  const search: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    search[key] = value;
  }
  return Object.keys(search).length > 0 ? { to, search } : { to };
}

export const noteApiClient = createHazyClient({
  baseUrl: env.API_URL,
  credentials: "include",
  getProfile: () => {
    if (typeof window === "undefined") return null;
    const match = window.location.pathname.match(/^\/p\/([^/]+)/);
    return match?.[1] ?? null;
  },
});

export const noteAuthClient = createHazyAuthClient(env.API_URL);
export const noteQueries = createHazyQueryOptions(noteApiClient);
export const noteSessionQueryOptions = authSessionQueryOptions(noteAuthClient);

export const noteQueryClient = createAppQueryClient({
  onUnauthorized: () => onUnauthorizedHandler?.(),
});
