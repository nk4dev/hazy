# api

hazy's backend — a **Hono Worker** (`hazy-api`) for `api.hz.nknighta.me`.
Extracted from `apps/hazy`'s old `/api/v1/**` route handlers. See `README.md`
for the route surface.

# Layout

- `@/*` → `./src/*` (tsconfig paths). The `lib/*` files moved verbatim from
  `apps/hazy/src/lib` keep their imports because of this.
- `src/app.ts` builds the Hono app (CORS, `onError`, routers). `src/index.ts` is
  the Worker entry; `src/server.ts` is local dev on `@hono/node-server`.
- `src/routes/*` — one Hono sub-app per group. Ported route handlers: `c.get("user")`
  for the auth'd user, `c.req.param()/.query()/.json()`, `zod .parse()` (caught by
  `onError`), `return ok(data, { status })`.
- `src/middleware/auth.ts` — `@clerk/backend` verifies the `Authorization: Bearer`
  token, resolves/creates the internal `users` row.
- `src/lib/api/response.ts` — `ok()` / `fail()`, plain `Response.json` (not
  `NextResponse`). Envelope: `{ data }` / `{ error: { code, message, details? } }`.

# Rules

- **Contract types live in `@repo/api-client`** (`packages/api-client/src/types.ts`),
  re-exported here as `@/types/api`. Add a DTO there, add the client method in
  `packages/api-client/src/client.ts`, then the route here — and update the
  matching genre file in `docs/ai/flutter/` (Flutter client reference).
- DB via `getDb()` (`@/db` → `@repo/db`). Schema changes → `packages/db` only.
- Runtime = workerd (prod) / Node (dev). `process.env` is populated from
  `wrangler.jsonc` vars + `wrangler secret`. Keep the `lib/*` code Workers-safe
  (no `fs`, no `node:*` beyond what's already there).
- `bun run dev --filter=api` (Node, :8787, reads `.dev.vars`).
  `bun run deploy --filter=api` = `wrangler deploy`. Secrets: `wrangler secret put`
  from `apps/api/` (never in `wrangler.jsonc`).

# Package manager

`bun`. `bun add <pkg> --filter api`. One `bun.lock` at the repo root.
