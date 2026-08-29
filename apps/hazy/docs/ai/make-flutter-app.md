# Building the Hazy Flutter client — brief for an AI coding agent

This document is a **self-contained brief** for an AI agent working in a
*separate* Flutter project. You will not have access to the Hazy web
repository — everything you need to build a working mobile client against
its backend is written out below: authentication, every endpoint, every
request/response shape, and the error contract.

Hazy is "a memory for the URLs you save": users save links, the backend
fetches and summarizes them, full-text search works over saved items, and
an AI "Ask" feature answers questions by citing the user's own saved pages.
The mobile app's job is to give a native Flutter front end to the exact
same backend the Next.js web app already uses — **do not invent new
endpoints or reshape the data**; consume `/api/v1/**` as documented here.

## 1. Base URL

```
https://<deployed-host>/api/v1
```

For local development against the web repo running on the same machine /
network, this is `http://localhost:3000/api/v1` (or the LAN IP printed by
`next dev`, since `localhost` won't resolve from a physical device/emulator
— use `10.0.2.2` for the Android emulator, or the host machine's LAN IP).

Ask the human operator for the actual deployed base URL before wiring up
production config — it is not fixed by this document.

## 2. Authentication

Auth is handled by **Clerk**, the same identity provider the web app uses.
There is no separate Hazy login system — do not build one.

- Use Clerk's official **Flutter SDK** (`clerk_flutter` /
  `clerk_auth`) to implement sign-in/sign-up (email, and whatever social
  providers the Clerk instance has enabled). The human operator will
  supply the Clerk **publishable key** for this project's Clerk instance.
- After a successful sign-in, Clerk gives you a **session token (JWT)**.
  Attach it to every `/api/v1/**` request as:

  ```
  Authorization: Bearer <clerk_session_token>
  ```

  Clerk's Next.js middleware (already deployed server-side) accepts Bearer
  tokens as an alternative to its own cookie session, so no backend changes
  are needed to support a mobile client.
- Tokens expire; refresh them the way the Clerk Flutter SDK recommends
  (it typically manages silent refresh for you — don't hand-roll refresh
  logic).
- **First-request user sync**: the backend lazily creates its internal
  `users` row (and default preferences) the first time an authenticated
  request reaches *any* endpoint — there is no separate "register" call to
  make. Simply sign in via Clerk and start calling the API.
- **The entire `/api/v1/**` surface requires a signed-in Clerk session** —
  there are no public/unauthenticated endpoints. A request without a valid
  token gets a `401 unauthorized` (see §4).

## 3. Response envelope

Every response is JSON with one of two shapes:

**Success:**
```json
{ "data": { /* endpoint-specific payload, see below */ } }
```

**Failure:**
```json
{
  "error": {
    "code": "string_error_code",
    "message": "Human-readable message.",
    "details": { }
  }
}
```
`details` is optional and present mainly on validation errors (see §4).
Always branch on the presence of `data` vs `error`, not on HTTP status
alone, though status codes are also meaningful (see below).

## 4. Errors

| HTTP status | `error.code`            | Meaning                                                        |
|-------------|--------------------------|------------------------------------------------------------------|
| 400         | `validation_error`       | Request body/query failed validation. `details` has Zod's flattened field errors. |
| 401         | `unauthorized`           | Missing/invalid/expired Clerk session.                          |
| 404         | `not_found`              | Resource doesn't exist, or exists but isn't owned by the caller (the API never distinguishes the two — treat 404 as "not yours or doesn't exist"). |
| 503         | `service_not_configured` | A required backend service (database, etc.) isn't configured server-side. Not something the client can fix — surface as a generic "try again later". |
| 500         | `internal_error`         | Unhandled server error.                                          |

All requests (mutating and non-mutating) can fail this way — always handle
the `error` branch, not just non-2xx status codes.

## 5. Data models

These are the exact TypeScript DTOs the backend returns; translate field
names/types 1:1 into your Dart models (camelCase JSON keys, as shown).

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
  nextCursor: string | null;     // pass back as `?cursor=` to page forward
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
  usedFallback: boolean;         // true if AI was unavailable and this is a plain keyword-match fallback
  createdAt: string;
  citations?: AskCitationDTO[];  // present on assistant messages
};

type AskThreadDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AskResponseDTO = {
  thread: AskThreadDTO;
  message: AskMessageDTO;        // the new assistant message
  citations: AskCitationDTO[];
  meta: { sourceCount: number };
};
```

## 6. Endpoints

All paths are relative to `/api/v1`. All require `Authorization: Bearer
<token>` (§2). All bodies are JSON (`Content-Type: application/json`).

### Saved items

**`POST /items`** — save a new URL (fetches metadata server-side; ~8s
timeout, so show a loading state).
Body: `{ "url": "https://..." }`
Returns `SavedUrlDTO`, `201` on new save, `200` if the URL was already
saved by this user (idempotent — dedupes by normalized URL, safe to call
from a "share sheet" style flow without checking first).

**`GET /items?cursor=&limit=&sort=`** — paginated list of saved items.
Query params (all optional): `cursor` (uuid, the last item's `id` from the
previous page's `nextCursor`), `limit` (1–100, default 30), `sort`
(`"newest" | "oldest"`, default `"newest"`).
Returns `PaginatedResponse<SavedUrlDTO>`.

**`GET /items/:id`** — fetch one saved item. Returns `SavedUrlDTO`.

**`PATCH /items/:id`** — edit title/summary.
Body (all optional): `{ "title"?: string | null, "summary"?: string | null }`
Returns updated `SavedUrlDTO`.

**`DELETE /items/:id`** — delete a saved item. Returns `{ "id": string }`.

**`POST /items/:id/refetch`** — re-fetch metadata for an already-saved URL
(e.g. a "retry" button after `fetchStatus: "error"`). No body.
Returns updated `SavedUrlDTO`.

**`POST /items/:id/summarize`** — (re)generate the AI summary for an
already-saved item. No body. Requires an AI key configured server-side —
if none is set, this fails `503 service_not_configured` rather than
succeeding with a fallback (unlike Ask, there's no non-AI summary to fall
back to). Returns updated `SavedUrlDTO` with a new `summary`.

### Search

**`GET /search?q=&limit=`** — plain Postgres full-text keyword search over
the caller's saved items. Works even with no AI configured server-side.
Query params: `q` (required, non-empty string), `limit` (1–50, default 20).
Returns `{ "query": string, "items": SavedUrlDTO[] }`.

### Read later

The "read later" surface buckets the user's inbox items into three groups
by estimated reading time, for a "what can I read right now" view.

**`GET /read-later`** — the bucketed queue.
Returns:
```ts
{
  totalCount: number;
  totalMinutes: number;
  todaysThreeMinutes: number;
  todaysThree: SavedUrlDTO[];   // curated "today's 3"
  fiveMinutes: SavedUrlDTO[];   // short reads
  sitDown: SavedUrlDTO[];       // longer reads
}
```

**`PATCH /read-later/:itemId`** — change an item's read-later status
(`itemId` is a `savedUrls.id`, same as `SavedUrlDTO.id`).
Body: `{ "status": "inbox" | "snoozed" | "read" | "archived", "snoozedUntil"?: string /* ISO 8601, required only when status is "snoozed" */ }`
Returns the updated `readLaterState` row (includes `status`,
`snoozedUntil`, `markedReadAt`, etc.).

**`GET /read-later/stats`** — 7-day reading activity, for a small chart.
Returns:
```ts
{
  days: { count: number; heightPct: number }[]; // 7 entries, oldest→newest, heightPct is 0-100 for bar charts
  readThisWeek: number;
  savedThisWeek: number;
}
```

### Collections

**`GET /collections`** — list the caller's collections.
Returns `{ "items": CollectionDTO[] }`.

**`POST /collections`** — create a collection.
Body: `{ "name": string (1-255 chars), "description"?: string (max 1000), "color"?: string (max 32) }`
Returns `CollectionDTO`, `201`.

**`GET /collections/:id`** — a collection with its items.
Returns:
```ts
{ id: string; name: string; description: string | null; color: string | null; items: SavedUrlDTO[] }
```

**`PATCH /collections/:id`** — edit a collection.
Body (all optional): `{ "name"?: string, "description"?: string | null, "color"?: string | null }`
Returns the updated collection row.

**`DELETE /collections/:id`** — delete a collection (items themselves are
not deleted, only the collection). Returns `{ "id": string }`.

**`POST /collections/:id/items`** — add a saved item to a collection.
Body: `{ "savedUrlId": string (uuid) }`
Returns `{ "collectionId": string, "savedUrlId": string }`, `201`.
Idempotent — adding the same item twice is a no-op, not an error.

**`DELETE /collections/:id/items/:savedUrlId`** — remove an item from a
collection. Returns `{ "collectionId": string, "savedUrlId": string }`.

### Ask (AI, citing the user's own saved items)

**`POST /ask`** — start a new thread with a question.
Body: `{ "question": string (1-2000 chars), "answerLanguageOverride"?: "en" | "ja" }`
Returns `AskResponseDTO`, `201`. If no AI key is configured server-side,
the response still succeeds but `message.usedFallback` is `true` and the
content is a plain "here's what matched" response instead of a synthesized
answer — render this the same way, just maybe with a small "AI unavailable"
hint if `usedFallback` is true.

The server answers by having the model search the user's saved links
itself (it may search multiple times per question before replying), so:
- **Latency is higher and more variable than a single LLM call** — budget
  for several seconds, and show a real loading/thinking state rather than
  a fixed-duration spinner.
- **`citations` can be a longer, variable-length list** (not a small fixed
  count) — don't design the citations UI around a small number of chips;
  a scrollable list is safer than a fixed row.
- `usedFallback: false` with an empty `citations` array is a valid
  response (the model answered without finding — or without needing — a
  saved source). Don't treat "no citations" as an error state.

**`GET /ask/threads`** — list the caller's threads (most recently updated
first, capped at 50).
Returns `{ "items": AskThreadDTO[] }`.

**`GET /ask/threads/:id`** — a thread with its full message history.
Returns:
```ts
{ thread: AskThreadDTO; messages: AskMessageDTO[] }
```

**`DELETE /ask/threads/:id`** — delete a thread and its messages.
Returns `{ "id": string }`.

**`POST /ask/threads/:id/messages`** — ask a follow-up in an existing
thread.
Body: same as `POST /ask`: `{ "question": string, "answerLanguageOverride"?: "en" | "ja" }`
Returns `AskResponseDTO`, `201`.

### Current user / preferences

**`GET /me`** — the caller's profile + preferences.
Returns:
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

**`PATCH /me`** — update preferences (not profile fields — those come from
Clerk).
Body (all optional): `{ "interfaceLocale"?: "en" | "ja", "answerLanguageMode"?: "interface" | "source", "notifyReadLaterDigest"?: boolean, "notifyWeeklyStats"?: boolean }`
Returns the updated preferences row.

### Not for the Flutter client

**`POST /webhooks/clerk`** is a server-to-server webhook Clerk calls
directly — it is not something the mobile app ever calls, and requires a
Svix signature the app can't produce. Ignore it entirely.

## 7. i18n

The backend is locale-aware via `preferences.interfaceLocale` (`en` |
`ja`) and `answerLanguageMode`. The Flutter app should:
- Let the user pick a UI language independent of the phone's system
  locale, matching the two supported values (`en`, `ja`).
- Persist the choice via `PATCH /me` (`interfaceLocale`), not just
  locally — the web app and mobile app should agree on this if the same
  user uses both.
- Pass `answerLanguageOverride` on `/ask` calls only when the user
  explicitly overrides the answer language for that one question;
  otherwise omit it and let the backend use `answerLanguageMode`.

## 8. Known gaps (don't build client features for these yet)

- **Push notifications**: `notifyReadLaterDigest` / `notifyWeeklyStats`
  preference toggles exist and persist, but nothing sends notifications
  yet server-side. Build the toggle UI if desired, but there's no push
  infrastructure to wire up on the client side yet — check with the human
  operator before investing in FCM/APNs setup.
- **Background metadata fetch**: `POST /items` fetches metadata
  synchronously (~8s timeout). There's no separate "processing" webhook or
  push to poll for completion — the initial response already reflects
  final `fetchStatus` (`success` or `error`), not an intermediate
  `pending` state you need to poll past. `pending` only appears if you
  fetch a row that's still mid-request from elsewhere (rare in practice).

## 9. Suggested build order

1. Clerk sign-in/sign-up (Flutter SDK) → confirm `GET /me` returns 200.
2. Library list (`GET /items`, paginated) + save flow (`POST /items`,
   ideally wired to the OS share sheet).
3. Item detail (`GET /items/:id`, `PATCH`, `DELETE`, `POST .../refetch`).
4. Read later (`GET /read-later`, `PATCH /read-later/:itemId`).
5. Search (`GET /search`).
6. Collections (full CRUD + item add/remove).
7. Ask (`POST /ask`, thread list/detail, follow-ups).
8. Preferences (`GET`/`PATCH /me`), locale switch.

This order front-loads the features that don't depend on AI being
configured, so the app is fully testable against a backend with just
Clerk + a database configured (no OpenRouter key needed until step 7).
