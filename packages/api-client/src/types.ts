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
  collectionIds: string[];
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

/** PUT /v1/items/:id/collections */
export type ItemCollectionsDTO = { savedUrlId: string; collectionIds: string[] };

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

/** GET /v1/auth-config (public) — exposes non-secret auth capabilities to the SPA. */
export type AuthConfigDTO = {
  betterAuth: boolean;
  github: boolean;
};

/** GET /v1/me */
export type MeDTO = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: UserPreferencesDTO;
  activeProfile?: ProfileDTO;
  profiles?: ProfileDTO[];
};

/** POST /v1/connect/authorize — the one-shot code hazy's `/connector/add` page redirects back with. */
export type ConnectCodeDTO = { code: string };

/** GET /v1/connect/apps — one live connected-app token. */
export type ConnectedAppDTO = {
  id: string;
  clientName: string;
  clientOrigin: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** POST /v1/connect/token (public) — PKCE code exchange. */
export type ConnectTokenDTO = { accessToken: string; tokenType: "Bearer"; clientName: string };

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

// ── hazy-note domain DTOs (`/v1/note/**`) ────────────────────────────────

export type NoteDeltaOp = {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
  retain?: number | Record<string, unknown>;
  delete?: number;
};

export type NoteSourceKind = "article" | "pdf" | "video" | "thread" | "note";
export type NoteItemStatus = "reading" | "ready";
export type NoteStatus = "draft" | "done";

export type NoteItemDTO = {
  id: string;
  url: string;
  kind: NoteSourceKind;
  site: string;
  title: string;
  addedAt: string;
  addedLabel: string;
  status: NoteItemStatus;
  durationLabel?: string;
  summary: string[];
  points: string[];
  suggestedTags: string[];
  tags: string[];
  projectId: string | null;
  quoteCandidates: number;
  relatedNoteId?: string;
};

export type NoteProjectDTO = {
  id: string;
  name: string;
  description: string | null;
  tone: "accent" | "neutral";
  count: number;
};

export type NoteProjectNoteRefDTO = {
  id: string;
  title: string;
  status: NoteStatus;
  updatedLabel: string;
};

export type NoteProjectDetailDTO = NoteProjectDTO & {
  sources: NoteItemDTO[];
  notes: NoteProjectNoteRefDTO[];
};

export type NoteTagDTO = {
  id: string;
  label: string;
  tone: "accent" | "neutral";
  count: number;
  urlCount: number;
  noteCount: number;
};

export type NoteSuggestionDTO = {
  id: string;
  kind: string;
  text: string;
  ref?: string;
};

export type NoteSourceRefDTO = {
  n: number;
  label: string;
  cited: boolean;
  url?: string;
};

export type NoteLinkDTO = {
  noteId: string;
  title: string;
  reason: string;
};

export type NoteTagBadgeDTO = {
  label: string;
  tone: "accent" | "neutral" | "outline";
};

export type NoteFlagDTO = {
  icon: string;
  tone: string;
  text: string;
};

export type NoteDTO = {
  id: string;
  title: string;
  projectId: string;
  tags: NoteTagBadgeDTO[];
  status: NoteStatus;
  updatedLabel: string;
  body: NoteDeltaOp[];
  suggestions: NoteSuggestionDTO[];
  sources: NoteSourceRefDTO[];
  links: NoteLinkDTO[];
  flags: NoteFlagDTO[];
};

export type NoteSearchHitDTO = {
  id: string;
  kind: NoteSourceKind;
  title: string;
  snippet: string;
  tags: string[];
  href: string;
  external: boolean;
  score?: number;
};

export type NoteSearchChatTurnDTO = {
  role: "user" | "assistant";
  content: string;
};

export type NoteSearchChatAnswerDTO = {
  answer: string;
  sources: NoteSearchHitDTO[];
  llm: boolean;
};

export type NoteInsightStatsDTO = {
  noteCount: number;
  noteCharTotal: number;
  noteCharAvg: number;
  notesLast30d: number;
  urlCount: number;
  urlReadCount: number;
  topDomains: { domain: string; count: number }[];
  kindMix: { kind: NoteSourceKind; count: number }[];
  topTags: { label: string; count: number }[];
  languageMix: { lang: string; count: number }[];
  span: { firstLabel: string; lastLabel: string } | null;
};

export type NoteInsightThemeDTO = {
  label: string;
  weight: number;
  note: string;
};

export type NoteInsightProfileDTO = {
  projectId: string;
  generatedLabel: string;
  llm: boolean;
  stats: NoteInsightStatsDTO;
  profile: string;
  themes: NoteInsightThemeDTO[];
  leanings: string[];
  blindSpots: string[];
  nextSteps: string[];
};

export type NoteExportFormat = "blog" | "memo" | "bullets";

export type NoteExportSectionProvenanceDTO = {
  heading: string;
  from: string;
  tone: "accent" | "muted";
};

export type NoteExportDraftDTO = {
  format: NoteExportFormat;
  meta: string;
  title: string;
  blocks: (
    | { type: "p"; text: string; dim?: boolean }
    | { type: "h4"; text: string }
    | { type: "note"; tone: string; text: string }
  )[];
  provenance: NoteExportSectionProvenanceDTO[];
  warning?: string;
};

export type NoteExportResultDTO = NoteExportDraftDTO & {
  exportedTo: string;
};

// ── Multi-Profile ─────────────────────────────────────────────────────
export type ProfileDTO = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateProfileInput = {
  slug: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  isDefault?: boolean;
};

export type UpdateProfileInput = {
  slug?: string;
  name?: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isDefault?: boolean;
};

// ── External Blog Integration ─────────────────────────────────────────
export type BlogProvider = "microcms" | "qiita" | "zenn";
export type BlogPostStatus = "draft" | "published" | "archived";

export type BlogConnectionDTO = {
  id: string;
  profileId: string;
  provider: BlogProvider;
  label: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  webhookUrl: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBlogConnectionInput = {
  provider: BlogProvider;
  label: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  isEnabled?: boolean;
};

export type UpdateBlogConnectionInput = {
  label?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  isEnabled?: boolean;
};

export type BlogPublicationDTO = {
  id: string;
  profileId: string;
  connectionId: string;
  noteId: string | null;
  savedUrlId: string | null;
  externalId: string;
  externalSlug: string | null;
  externalUrl: string | null;
  title: string;
  status: BlogPostStatus;
  tags: string[];
  publishedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogPublishInput = {
  connectionId: string;
  noteId?: string;
  publicationId?: string;
  title: string;
  markdown: string;
  status?: "draft" | "published";
  tags?: string[];
  slug?: string;
  emoji?: string;
  zennType?: "tech" | "idea";
  citedSavedUrlIds?: string[];
  citedCollectionIds?: string[];
  citationStyle?: "list" | "footnote" | "cards";
};

export type BlogSyncResultDTO = {
  upserted: number;
  deleted: number;
};
