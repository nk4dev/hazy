/**
 * The wire contract for the hazy API (`https://api.hz.nknighta.me`, served at
 * `/v1/**`). This module is the single source of truth every Route Handler in
 * `apps/api` returns data matching, and every client — the hazy web app today,
 * a Flutter app later — is built against.
 *
 * Success responses are wrapped in `{ data: T }`, failures in
 * `{ error: { code, message, details? } }` (see `apps/api/src/lib/api/response.ts`).
 */

export type SavedUrlDTO = {
  id: string;
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  summary: string | null;
  tags: string[];
  contentLanguage: string | null;
  estimatedReadMinutes: number | null;
  fetchStatus: "pending" | "success" | "error";
  fetchError: string | null;
  createdAt: string;
  updatedAt: string;
  readLaterStatus: "inbox" | "snoozed" | "read" | "archived" | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export type CollectionDTO = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  /** AI-generated overview of the whole collection; null until generated. */
  summary: string | null;
  summaryUpdatedAt: string | null;
  itemCount: number;
  /** Up to 4 recent og:image URLs from the collection's items, for a preview thumbnail. */
  previewImages: string[];
  createdAt: string;
};

/** GET /v1/collections/:id — a collection plus its saved URLs. */
export type CollectionDetailDTO = CollectionDTO & { items: SavedUrlDTO[] };

/** POST /v1/collections/:id/summarize */
export type CollectionSummaryDTO = { summary: string; summaryUpdatedAt: string };

/** POST /v1/collections/:id/items, DELETE /v1/collections/:id/items/:savedUrlId */
export type CollectionItemRefDTO = { collectionId: string; savedUrlId: string };

export type AskCitationDTO = {
  savedUrlId: string;
  title: string | null;
  domain: string | null;
  url: string;
  faviconUrl: string | null;
  snippet: string;
  rank: number;
};

export type AskMessageDTO = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;
  usedFallback: boolean;
  createdAt: string;
  citations?: AskCitationDTO[];
};

export type AskThreadDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AskThreadListDTO = { items: AskThreadDTO[] };

/** GET /v1/ask/threads/:id */
export type AskThreadDetailDTO = { thread: AskThreadDTO; messages: AskMessageDTO[] };

export type AskResponseDTO = {
  thread: AskThreadDTO;
  message: AskMessageDTO;
  citations: AskCitationDTO[];
  meta: { sourceCount: number };
};

export type UserPreferencesDTO = {
  interfaceLocale: "en" | "ja";
  answerLanguageMode: "interface" | "source";
  notifyReadLaterDigest: boolean;
  notifyWeeklyStats: boolean;
};

/** GET /v1/me */
export type MeDTO = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: UserPreferencesDTO;
};

/** GET /v1/read-later */
export type ReadLaterQueueDTO = {
  totalCount: number;
  totalMinutes: number;
  todaysThreeMinutes: number;
  todaysThree: SavedUrlDTO[];
  fiveMinutes: SavedUrlDTO[];
  sitDown: SavedUrlDTO[];
};

/** GET /v1/read-later/stats */
export type ReadLaterStatsDTO = {
  days: { count: number; heightPct: number }[];
  readThisWeek: number;
  savedThisWeek: number;
};

/** PATCH /v1/read-later/:itemId — the updated read-later state row. */
export type ReadLaterStateDTO = {
  status: "inbox" | "snoozed" | "read" | "archived";
  snoozedUntil: string | null;
  markedReadAt: string | null;
};

/** GET /v1/search */
export type SearchResponseDTO = { query: string; items: SavedUrlDTO[] };

export type ReadLaterStatus = "inbox" | "snoozed" | "read" | "archived";
