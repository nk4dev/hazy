/**
 * Shared request/response shapes for /api/v1/**. This file is the reference
 * contract a future Flutter client should be built against — every Route
 * Handler under src/app/api/v1 should return data matching these types,
 * wrapped in `{ data: T }` on success or `{ error: { code, message,
 * details? } }` on failure (see src/lib/api/response.ts).
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
  itemCount: number;
  createdAt: string;
};

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

export type AskResponseDTO = {
  thread: AskThreadDTO;
  message: AskMessageDTO;
  citations: AskCitationDTO[];
  meta: { sourceCount: number };
};
