# api

hazy's backend as a standalone service — a **Hono** Worker for `https://api.hz.nknighta.me`.
Serves Better Auth (`/api/auth/**`) and the full `/v1/**` JSON API for `hazy`, `hazy-note`, `hazy-dash`, and Flutter.

## Surface

Everything under `/v1` returns `{ data }` on success / `{ error: { code, message, details? } }` on failure (`GET /health` and `GET /v1/auth-config` are unauthenticated; `/api/auth/**` is Better Auth's auth handler):

| Group | Routes |
|---|---|
| `auth` (Better Auth) | `/api/auth/*` — GitHub OAuth, sign-out, session, cross-subdomain `HttpOnly` cookie; email/password disabled; gated fail-closed by `ADMIN_EMAIL` |
| `auth-config` | `GET /v1/auth-config` (public — exposes `betterAuth`, `github`) |
| `items` | `GET /`, `POST /`, `GET/PATCH/DELETE /:id`, `POST /:id/refetch`, `POST /:id/summarize`, `PUT /:id/collections`, `GET /:id/image` |
| `collections` | `GET /`, `POST /`, `GET/PATCH/DELETE /:id`, `POST /:id/items`, `DELETE /:id/items/:savedUrlId`, `POST /:id/summarize` |
| `ask` | `POST /`, `GET /threads`, `GET/DELETE /threads/:id`, `POST /threads/:id/messages` |
| `read-later` | `GET /`, `GET /stats`, `PATCH /:itemId` |
| `search` | `GET /` |
| `me` | `GET /`, `PATCH /` |
| `connect` | `POST /authorize`, `GET /apps`, `DELETE /apps/:id`, `POST /token` (public PKCE) |
| `note` | `/v1/note/items/*`, `/v1/note/notes/*`, `/v1/note/projects/*`, `/v1/note/tags`, `/v1/note/search/chat`, `/v1/note/analyze`, `/v1/note/export` |
| `webhooks` | `POST /clerk` — Svix-verified legacy webhook, no auth middleware |

`docs/ai/flutter/` re-documents the `/v1` surface by genre for the Flutter hazy app. Update it alongside the contract.

## Layout

```
src/
  index.ts                 Worker entry — export default createApp()
  server.ts                local dev — @hono/node-server on :8787
  app.ts                   the Hono app: split CORS, onError, /api/auth/*, routers
  env.ts                   zod-validated process.env (from wrangler vars/secrets)
  middleware/auth.ts       hz_ token -> Better Auth session -> Clerk fallback -> internal users row on c.get("user")
  routes/*                 one Hono sub-app per group (including routes/note/*)
  lib/                     ai/, search/, metadata/, read-later/, serializers.ts,
                           api/{errors,response}.ts, auth/{api-token,better-auth,current-user,origins}.ts
  db/                      getDb() (@repo/db) + schema re-export
```

`@/*` resolves to `./src/*`.

## Dev / deploy

```bash
op run --env-file=".env.op" -- bun run dev --filter=api        # local PG (127.0.0.1:5433)
op run --env-file=".env.prod.op" -- bun --filter @repo/db db:migrate  # Neon production
bun run preview --filter=api                                   # wrangler dev (workerd)
bun run deploy --filter=api                                    # wrangler deploy
```

Node dev uses the postgres.js TCP driver for a `127.0.0.1` `DATABASE_URL`;
production (and `wrangler dev`) uses `@repo/db`'s Neon HTTP driver.

Production secrets are stored in 1Password (`Hazy` vault) and registered with `op read ... | bunx wrangler secret put <KEY> --cwd apps/api` (never plaintext files or `wrangler.jsonc`):

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `ADMIN_EMAIL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OPENROUTER_API_KEY`
- Temporary Clerk fallback secrets if still enabled: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`

Non-secret config (`BETTER_AUTH_URL`, `BETTER_AUTH_COOKIE_DOMAIN`, `OPENROUTER_MODEL_ID`, `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_NOTE_MODEL_ID`, `OPENROUTER_NOTE_FALLBACK_MODELS`, `OPENROUTER_TIMEOUT_MS`, `CORS_ALLOWED_ORIGINS`, …) is in `wrangler.jsonc` `vars`.

## Notes

- **CORS security:** `/api/auth/*` and `/v1/*` issue `Access-Control-Allow-Credentials: true` only for `isAllowedOrigin` (`CORS_ALLOWED_ORIGINS` + local dev). `/v1/*` allows uncredentialed requests from connected-app origins (`isConnectedOrigin`), and `/v1/connect/token` is open without credentials. Auth errors (`401`/`403`) preserve CORS headers.
- **Query projections:** `SAVED_URL_SUMMARY_COLUMNS` omits `extractedText` and `searchVector` in list/detail/collection/read-later/ask responses; `/v1/read-later/stats` projects only `markedReadAt` plus `count()`.
- **OpenRouter resilience (`src/lib/ai/openrouter.ts`):** automatically retries transient 429/5xx/timeout errors with jittered backoff (`Retry-After`), detects HTTP 200 `{ error }` bodies, tracks per-model in-memory cooldowns, falls back across `OPENROUTER_FALLBACK_MODELS` / `OPENROUTER_NOTE_FALLBACK_MODELS`, and maps exhausted failures to `OpenRouterError`.
- `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]` enforces the SSRF guard for `fetchUrlMetadata`'s outbound requests.
- `search` assumes `saved_urls.search_vector` is maintained by the DB trigger (`packages/db/sql/search-vector-trigger.sql`).
