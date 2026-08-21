# Hazy API — external client reference

This is the public contract for `/api/v1/**`, the JSON API the Hazy web
app itself runs on. It's stable enough to build any external client
against — a smartphone app, a browser extension, a CLI — without needing
access to this repository's source. There is no separate "public API" or
API-key system: external clients authenticate the same way the web app
does, via a Clerk session token.

A rendered, browsable version of this same reference is served at `/docs`
in the running app.

## Base URL

```
https://<deployed-host>/api/v1
```

For local development, `http://localhost:3000/api/v1` (use `10.0.2.2` in
place of `localhost` from an Android emulator; a physical device needs the
host machine's LAN IP).

## Authentication

Auth is handled by **Clerk**. There is no separate Hazy login system.

- Sign in via any Clerk client SDK (web, iOS, Android, Flutter, React
  Native, ...) for the same Clerk instance this deployment uses. Ask the
  operator for the Clerk **publishable key**.
- Attach the resulting session token to every request:
  ```
  Authorization: Bearer <clerk_session_token>
  ```
- **First-request user sync**: the backend lazily creates its internal
  `users` row (and default preferences) the first time an authenticated
  request reaches *any* endpoint. There is no separate "register" call.
- The entire `/api/v1/**` surface (aside from the Clerk webhook, see
  below) requires a signed-in session — there are no public/anonymous
  endpoints. A request without a valid token gets `401 unauthorized`.

## Response envelope

**Success:**
```json
{ "data": { /* endpoint-specific payload */ } }
```

**Failure:**
```json
{ "error": { "code": "string_error_code", "message": "Human-readable message.", "details": {} } }
```
`details` is optional. Always branch on the presence of `data` vs `error`
in the body — status codes are also meaningful (see below), but the body
shape is the source of truth.

## Errors

| HTTP status | `error.code` | Meaning |
|---|---|---|
| 400 | `validation_error` | Request body/query failed validation. `details` has Zod's flattened field errors when the failure was schema validation; a handful of routes also raise this code deliberately for a specific bad-state check (noted per-endpoint below). |
| 401 | `unauthorized` | Missing/invalid/expired Clerk session. |
| 404 | `not_found` | Resource doesn't exist, or exists but isn't owned by the caller — the API never distinguishes the two. Treat 404 as "not yours or doesn't exist." |
| 503 | `service_not_configured` | A required backend service isn't configured server-side (database, or the AI provider for AI-only endpoints). `details: { service }`. Not something the client can fix — surface as "try again later." |
| 500 | `internal_error` | Unhandled server error. |

All requests, mutating and non-mutating, can fail this way — always
handle the `error` branch, not just non-2xx status.

## Data models

Exact TypeScript DTOs the backend returns. A few endpoints intentionally
return a raw database row instead of one of these DTOs — called out
explicitly where that's the case.

```ts
type SavedUrlDTO = {
  id: string;                    // uuid
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  summary: string | null;        // AI-written summary, if generated
  contentLanguage: string | null;
  estimatedReadMinutes: number | null;
  fetchStatus: "pending" | "success" | "error";
  fetchError: string | null;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  readLaterStatus: "inbox" | "snoozed" | "read" | "archived" | null;
};

type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;     // pass back as ?cursor= to page forward
};

type CollectionDTO = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  itemCount: number;
  createdAt: string;
};

type AskCitationDTO = {
  savedUrlId: string;
  title: string | null;
  domain: string | null;
  url: string;
  faviconUrl: string | null;
  snippet: string;
  rank: number;                  // 1-based citation order
};

type AskMessageDTO = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;        // which AI model answered (assistant messages only)
  usedFallback: boolean;         // true if AI was unavailable/failed and this is a plain keyword-match fallback
  createdAt: string;
  citations?: AskCitationDTO[];  // present on assistant messages (always an array, possibly empty, when fetched via GET /ask/threads/:id)
};

type AskThreadDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AskResponseDTO = {
  thread: AskThreadDTO;
  message: AskMessageDTO;
  citations: AskCitationDTO[];
  meta: { sourceCount: number };
};
```

## Endpoints

All paths are relative to `/api/v1`. All require `Authorization: Bearer
<token>` (see Authentication) except the Clerk webhook. All bodies are
JSON (`Content-Type: application/json`).

### Saved items

**`POST /items`** — save a new URL (fetches metadata server-side; ~8s
timeout, show a loading state).
Body: `{ "url": string }`
Idempotent — dedupes by normalized URL. Returns `SavedUrlDTO`, `200` if
the URL was already saved by this user, `201` if newly saved.

**`GET /items?cursor=&limit=&sort=`** — paginated list of saved items.
Query (all optional): `cursor` (uuid, from the previous page's
`nextCursor`), `limit` (1–100, default 30), `sort` (`"newest" |
"oldest"`, default `"newest"`).
Returns `PaginatedResponse<SavedUrlDTO>`.

**`GET /items/:id`** — Returns `SavedUrlDTO`.

**`PATCH /items/:id`** — edit title/summary.
Body (all optional): `{ "title"?: string | null (≤500 chars), "summary"?: string | null (≤4000 chars) }`
Returns updated `SavedUrlDTO`.

**`DELETE /items/:id`** — Returns `{ "id": string }`.

**`POST /items/:id/refetch`** — re-fetch metadata for an already-saved URL
(e.g. a "retry" button after `fetchStatus: "error"`). No body.
Returns updated `SavedUrlDTO`.

**`POST /items/:id/summarize`** — (re)generate the AI summary. No body.
Fails `503 service_not_configured` if no AI key is set server-side
(unlike Ask, there's no non-AI fallback for this one).
Returns updated `SavedUrlDTO`.

### Search

**`GET /search?q=&limit=`** — plain Postgres full-text keyword search
over the caller's saved items. Works even with no AI configured.
Query: `q` (required, non-empty), `limit` (1–50, default 20).
Returns `{ "query": string, "items": SavedUrlDTO[] }`.

### Read later

Buckets the user's inbox items by estimated reading time, for a "what can
I read right now" view.

**`GET /read-later`** — Returns:
```ts
{
  totalCount: number;
  totalMinutes: number;
  todaysThreeMinutes: number;
  todaysThree: SavedUrlDTO[];
  fiveMinutes: SavedUrlDTO[];
  sitDown: SavedUrlDTO[];
}
```

**`PATCH /read-later/:itemId`** — change an item's read-later status
(`itemId` is a `savedUrls.id`).
Body: `{ "status": "inbox" | "snoozed" | "read" | "archived", "snoozedUntil"?: string /* ISO 8601 */ }`
**Returns the raw `read_later_state` row**, not a `SavedUrlDTO`:
```ts
{
  id: string; userId: string; savedUrlId: string;
  status: "inbox" | "snoozed" | "read" | "archived";
  snoozedUntil: string | null; markedReadAt: string | null;
  createdAt: string; updatedAt: string;
}
```

**`GET /read-later/stats`** — 7-day reading activity, for a small chart.
Returns:
```ts
{
  days: { count: number; heightPct: number }[]; // 7 entries, oldest→newest
  readThisWeek: number;
  savedThisWeek: number;
}
```

### Collections

**`GET /collections`** — Returns `{ "items": CollectionDTO[] }`.

**`POST /collections`** — Body: `{ "name": string (1-255 chars), "description"?: string (≤1000), "color"?: string (≤32) }`
Returns `CollectionDTO`, `201`.

**`GET /collections/:id`** — a collection with its items (custom shape,
not `CollectionDTO` — has `items` instead of `itemCount`):
```ts
{ id: string; name: string; description: string | null; color: string | null; items: SavedUrlDTO[] }
```

**`PATCH /collections/:id`** — Body (all optional): `{ "name"?: string, "description"?: string | null, "color"?: string | null }`
**Returns the raw `collections` row** (no `itemCount` field, unlike
`CollectionDTO`).

**`DELETE /collections/:id`** — items themselves are not deleted, only
the collection. Returns `{ "id": string }`.

**`POST /collections/:id/items`** — Body: `{ "savedUrlId": string (uuid) }`
Idempotent (adding the same item twice is a no-op).
Returns `{ "collectionId": string, "savedUrlId": string }`, `201`.

**`DELETE /collections/:id/items/:savedUrlId`** — Returns `{ "collectionId": string, "savedUrlId": string }`.

### Ask (AI, citing the user's own saved items)

**`POST /ask`** — start a new thread with a question.
Body: `{ "question": string (1-2000 chars), "answerLanguageOverride"?: "en" | "ja" }`
Returns `AskResponseDTO`, `201`. If AI isn't configured, or the AI call
fails for any reason, this **does not error** — it succeeds with
`message.usedFallback: true` and plain keyword-match content instead of a
synthesized answer. The model answers by searching the user's saved links
itself (possibly several times per question), so:
- Latency is higher and more variable than a single LLM call — expect
  several seconds, and show a real loading/thinking state.
- `citations` is a variable-length list, not a small fixed count — don't
  design the UI around a small number of chips.
- `usedFallback: false` with empty `citations` is valid (the model
  answered without needing, or without finding, a saved source).

**`GET /ask/threads`** — the caller's threads, most recently updated
first, capped at 50. Returns `{ "items": AskThreadDTO[] }`.

**`GET /ask/threads/:id`** — a thread with its full message history.
Returns:
```ts
{ thread: AskThreadDTO; messages: (AskMessageDTO & { citations: AskCitationDTO[] })[] }
```

**`DELETE /ask/threads/:id`** — Returns `{ "id": string }`.

**`POST /ask/threads/:id/messages`** — ask a follow-up in an existing
thread. Body: same as `POST /ask`.
Returns `AskResponseDTO`, `201`. If `:id` doesn't exist or isn't owned by
the caller, this fails **`400 validation_error`** ("Thread not found") —
not `404` like every other resource lookup in this API. Handle that case
specifically if you route errors by status code.

### Current user / preferences

**`GET /me`** — Returns:
```ts
{
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: {
    interfaceLocale: "en" | "ja";
    answerLanguageMode: "interface" | "source"; // "source" = answer in the saved page's language rather than the UI language
    notifyReadLaterDigest: boolean;
    notifyWeeklyStats: boolean;
  };
}
```

**`PATCH /me`** — update preferences (not profile fields — those come
from Clerk).
Body (all optional): `{ "interfaceLocale"?: "en" | "ja", "answerLanguageMode"?: "interface" | "source", "notifyReadLaterDigest"?: boolean, "notifyWeeklyStats"?: boolean }`
Returns the raw updated `user_preferences` row.

### Not for external clients

**`POST /webhooks/clerk`** is a server-to-server webhook Clerk calls
directly. It doesn't use the `{ data }` / `{ error }` envelope (plain-text
responses), doesn't accept a Clerk session token (it verifies a Svix
signature instead), and isn't something any client app calls. Ignore it.

## Versioning and rate limits

The API is unversioned beyond the `/v1` path prefix — there's no
deprecation policy or additional version negotiation yet, and no rate
limiting is currently enforced server-side. Both are worth revisiting
before opening this up to untrusted third-party developers; as it stands,
this contract is meant for clients the operator controls (their own
mobile app, browser extension, etc.), not arbitrary external integrators.

## i18n

The backend is locale-aware via `preferences.interfaceLocale` (`en` |
`ja`) and `answerLanguageMode`. A client should:
- Let the user pick a UI language independent of the device's system
  locale, matching the two supported values.
- Persist the choice via `PATCH /me` (`interfaceLocale`), not just
  locally, so it's consistent across every client the same user uses.
- Pass `answerLanguageOverride` on `/ask` calls only when the user
  explicitly overrides the answer language for that one question;
  otherwise omit it and let the backend use `answerLanguageMode`.
