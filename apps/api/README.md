# api

hazy's backend as a standalone service — a small **Hono** Worker for
`https://api.hz.nknighta.me`. Extracted from `apps/hazy`'s old
`/api/v1/**` route handlers; hazy is now a pure frontend that calls this
over CORS with a Clerk bearer token.

## Surface

Everything under `/v1`, `{ data }` on success / `{ error: { code, message, details? } }`
on failure:

| Group | Routes |
|---|---|
| `items` | `GET /`, `POST /`, `GET/PATCH/DELETE /:id`, `POST /:id/refetch`, `POST /:id/summarize` |
| `collections` | `GET /`, `POST /`, `GET/PATCH/DELETE /:id`, `POST /:id/items`, `DELETE /:id/items/:savedUrlId`, `POST /:id/summarize` |
| `ask` | `POST /`, `GET /threads`, `GET/DELETE /threads/:id`, `POST /threads/:id/messages` |
| `read-later` | `GET /`, `GET /stats`, `PATCH /:itemId` |
| `search` | `GET /` |
| `me` | `GET /`, `PATCH /` |
| `webhooks` | `POST /clerk` — Svix-verified, no auth middleware |

`GET /health` is unauthenticated. The DTO shapes are the contract in
`@repo/api-client` (`packages/api-client/src/types.ts`).

`docs/ai/flutter/` re-documents this whole surface by genre (auth, errors,
models, items, collections, ask, read-later, search, me) for the Flutter
hazy app. Update it alongside the contract.

## Layout

```
src/
  index.ts        Worker entry — export default createApp()
  server.ts       local dev — @hono/node-server on :8787
  app.ts          the Hono app: CORS, onError, routers
  env.ts          zod-validated process.env (from wrangler vars/secrets)
  middleware/auth.ts   Clerk bearer -> internal users row on c.get("user")
  routes/*        one Hono sub-app per group
  lib/            ai/, search/, metadata/, read-later/, serializers.ts,
                  api/{errors,response}.ts, auth/current-user.ts — moved
                  from apps/hazy, Workers-safe as-is
  db/             getDb() (@repo/db) + schema re-export
```

`@/*` resolves to `./src/*`, so the moved `lib/*` files keep their imports.

## Dev / deploy

```bash
bun run dev --filter=api      # tsx watch, real Node, :8787, reads .dev.vars
bun run preview --filter=api  # wrangler dev (workerd) — point .dev.vars DATABASE_URL at a Neon branch
bun run deploy --filter=api   # wrangler deploy
```

Node dev uses the postgres.js TCP driver for a `127.0.0.1` `DATABASE_URL`;
production (and `wrangler dev`) uses `@repo/db`'s Neon HTTP driver.

`.dev.vars` (gitignored, copy `.dev.vars.example`) feeds both `tsx --env-file`
and `wrangler dev`. Production secrets:

```bash
cd apps/api
wrangler secret put DATABASE_URL
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put OPENROUTER_API_KEY
```

Non-secret config (`OPENROUTER_MODEL_ID`, `CORS_ALLOWED_ORIGINS`, …) is in
`wrangler.jsonc` `vars`. After deploy, set the Clerk dashboard webhook endpoint
to `https://api.hz.nknighta.me/v1/webhooks/clerk`.

## Notes

- `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]` — the
  second is the SSRF guard for `fetchUrlMetadata`'s outbound requests.
- `search` assumes `saved_urls.search_vector` is maintained by the DB trigger
  (`packages/db/sql/search-vector-trigger.sql`, applied out of band).
- hazy-note still runs its own `/api/*`; migrating it here is a follow-up.
