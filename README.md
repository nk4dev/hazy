# hazy

Turborepo for **hazy** and **hazy-note** — two views of one product, one Clerk
tenant, one database.

| | |
|---|---|
| `apps/hazy` | Save URLs, search your reading, ask questions about it, read-later digest. Next 16 (Turbopack), next-intl (en/ja). |
| `apps/hazy-note` | Turn saved URLs into your own writing: capture → organise → notes → compare → graph → export. Next 16. |
| `packages/db` | `@repo/db` — the single Drizzle schema + client + migrations + search-vector trigger. See `packages/db/README.md`. |

Both apps resolve the signed-in Clerk user to a `users` row by `clerk_id`; same
Clerk instance → same `users.id` → `saved_urls` / `collections` are shared. A URL
saved in hazy shows up in hazy-note's library and vice versa.

## Getting started

```bash
bun install
# packages/db/.env.local + apps/*/.env.local — DATABASE_URL, Clerk, OpenRouter
bun run dev            # turbo: hazy-note on :3000, hazy on :3100
```

Local Postgres for development: `apps/hazy-note/scripts/localdb.sh start`
(user-owned PG on `127.0.0.1:5433`, no Docker). Then, from `packages/db/`:
`bun db:push && bun db:trigger`.

## Tasks (`bun run <task>` at the root → `turbo run`)

| Task | |
|---|---|
| `dev` | Both dev servers, Turbopack (`--filter=hazy` / `--filter=hazy-note` for one) |
| `build` | `next build --turbopack` for both |
| `lint` | Biome |
| `check-types` | `tsc --noEmit` across all three packages |
| `db:generate` / `db:migrate` / `db:push` / `db:trigger` / `db:studio` | `@repo/db`, driven by `packages/db/.env.local` |
| `cf:build` / `cf:deploy` / `cf:preview` | Per app — OpenNext → Cloudflare Workers |

## Deploy

Each app is its **own Cloudflare Worker** (`apps/*/wrangler.jsonc`,
`open-next.config.ts`). Both use `@repo/db`'s Neon HTTP driver on the Worker
runtime (no raw TCP sockets there). Locally, a `127.0.0.1` `DATABASE_URL`
transparently switches to the postgres.js TCP driver instead.

Deploy one: `bun run cf:deploy --filter=hazy` (needs `wrangler login` +
`apps/hazy/.dev.vars` for `cf:preview`). Or point Cloudflare Workers Builds at
each app dir with build `bunx turbo run cf:build --filter=<app>`.

`next.config.ts` in each app externalizes `drizzle-orm` etc. from the server
bundle **only for the production/Worker build** (`PHASE_PRODUCTION_BUILD`) —
Turbopack's dev server can't resolve a package externalized through the
`@repo/db` workspace package, and the size win only matters for the 3 MiB
Worker limit.
