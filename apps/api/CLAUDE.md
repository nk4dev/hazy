# api

hazy's backend — a **Hono Worker** (`hazy-api`) for `api.hz.nknighta.me`.
Serves `/api/auth/**` (Better Auth), `/v1/**` (including `/v1/note/**` for `hazy-note`), and `/v1/webhooks/clerk`. See `README.md` for the route surface.

# Layout

- `@/*` → `./src/*` (tsconfig paths).
- `src/app.ts` builds the Hono app (split CORS, `onError`, Better Auth mount `/api/auth/*`, `/v1/auth-config`, routers). `src/index.ts` is the Worker entry; `src/server.ts` is local dev on `@hono/node-server`.
- `src/routes/*` — one Hono sub-app per group (including `routes/note/*` at `/v1/note/**`). Route handlers use `c.get("user")` for the auth'd user, `c.req.param()/.query()/.json()`, `zod .parse()` (caught by `onError`), `return ok(data, { status })`.
- `src/lib/auth/better-auth.ts` — Better Auth instance (`auth_user`, `auth_session`, `auth_account`, `auth_verification`), `crossSubDomainCookies`, GitHub OAuth only (email/password disabled), and `ADMIN_EMAIL` fail-closed `databaseHooks.user.create.before`.
- `src/middleware/auth.ts` — verifies Bearer `hz_` tokens (`api_token`), Better Auth session cookies (`better_auth`), or temporary Clerk JWT fallback (`clerk`), and resolves/links the internal `users` row (`users.id` UUID preserved).
- `src/lib/api/response.ts` — `ok()` / `fail()`, plain `Response.json`. Envelope: `{ data }` / `{ error: { code, message, details? } }`.

# Rules

- **Contract types live in `@repo/api-client`** (`packages/api-client/src/types.ts`),
  re-exported here as `@/types/api`. Add a DTO there, add the client method in
  `packages/api-client/src/client.ts`, add query helpers in `packages/api-client/src/query.ts`, then the route here — and update the matching genre file in `docs/ai/flutter/`.
- DB via `getDb()` (`@/db` → `@repo/db`). Schema changes → `packages/db` only.
  Keep large column exclusions (`SAVED_URL_SUMMARY_COLUMNS`, omitting `extractedText` & `searchVector`) on list/detail/collection/read-later/ask queries.
- Runtime = workerd (prod) / Node (dev). `process.env` is populated from `wrangler.jsonc` vars + `wrangler secret` (prod) or `op run --env-file=".env.op"` (local dev). Never store plaintext secrets in files or `wrangler.jsonc`.
- `bun run dev --filter=api` (Node, :8787). `bun run deploy --filter=api` = `wrangler deploy`.
- OpenRouter resilience (`src/lib/ai/openrouter.ts`): supports model fallback chains (`OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_NOTE_FALLBACK_MODELS`), per-model in-memory cooldowns, HTTP 200 `{ error }` detection, JSON `response_format` auto-downgrade, and `OpenRouterError` (`429 ai_rate_limited` / `504 ai_timeout` / `503|502 ai_unavailable`).

# Package manager

`bun`. `bun add <pkg> --filter api`. One `bun.lock` at the repo root.
