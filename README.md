# hazy

Turborepo for **hazy** and **hazy-note** — two views of one product, one Clerk
tenant, one database, one API.

**Overview / showcase:** https://apps.nknighta.me/hazy/ (`docs/`, GitHub Pages) —
what it is, the architecture, and the AI-native toolchain it's built with.
Every commit here is agent-authored.

| | |
|---|---|
| `apps/hazy` | Save URLs, search your reading, ask questions about it, read-later digest. Pure frontend (Next 16, Turbopack, next-intl en/ja) — talks to `apps/api`. |
| `apps/hazy-note` | Turn saved URLs into your own writing: capture → organise → notes (Quill editor) → compare → export. Next 16. Still has its own `/api/*` route handlers. |
| `apps/api` | The hazy backend — a **Hono Worker** for `api.hz.nknighta.me`. Serves hazy's `/v1/**` JSON API + the Clerk webhook. See `apps/api/README.md`. |
| `packages/api-client` | `@repo/api-client` — the typed client (`createHazyClient` / `useHazyClient`) + the wire-contract DTO types, shared by hazy and any future native client. |
| `packages/db` | `@repo/db` — the single Drizzle schema + client + migrations + search-vector trigger. See `packages/db/README.md`. |

Both apps resolve the signed-in Clerk user to a `users` row by `clerk_id`; same
Clerk instance → same `users.id` → `saved_urls` / `collections` are shared. A URL
saved in hazy shows up in hazy-note's library and vice versa.

## Getting started

```bash
bun install
# packages/db/.env.local + apps/*/.env.local + apps/api/.dev.vars
#   — DATABASE_URL, Clerk, OpenRouter
bun run dev     # turbo: api on :8787, hazy-note on :3000, hazy on :3100
```

hazy dev needs `NEXT_PUBLIC_API_URL=http://localhost:8787` in `apps/hazy/.env.local`.

Local Postgres for development: `apps/hazy-note/scripts/localdb.sh start`
(user-owned PG on `127.0.0.1:5433`, no Docker). Then, from `packages/db/`:
`bun db:push && bun db:trigger`.

## Tasks (`bun run <task>` at the root → `turbo run`)

| Task | |
|---|---|
| `dev` | All dev servers (`--filter=<app>` for one). api runs on `@hono/node-server`; hazy / hazy-note on `next dev --turbopack` |
| `build` | `next build --turbopack` for the Next apps |
| `lint` | Biome |
| `check-types` | `tsc --noEmit` across every package |
| `deploy` / `preview` | `apps/api` — `wrangler deploy` / `wrangler dev` |
| `cf:build` / `cf:deploy` / `cf:preview` | `apps/hazy` / `apps/hazy-note` — OpenNext → Cloudflare Workers |
| `db:generate` / `db:migrate` / `db:push` / `db:trigger` / `db:studio` | `@repo/db`, driven by `packages/db/.env.local` |

## Deploy

Three independent Cloudflare Workers, each on its own custom domain:

| Worker | Domain | |
|---|---|---|
| `hazy-api` (`apps/api`) | `api.hz.nknighta.me` | plain Hono, no OpenNext |
| `hazy` (`apps/hazy`) | `hz.nknighta.me` | OpenNext |
| `hazy-note` (`apps/hazy-note`) | `note.hz.nknighta.me` | OpenNext |

- **`apps/api`** — `bun run deploy --filter=api`, then `wrangler secret put …`
  from `apps/api/` for `DATABASE_URL`, `CLERK_SECRET_KEY`,
  `CLERK_WEBHOOK_SIGNING_SECRET`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `OPENROUTER_API_KEY`. Clerk dashboard webhook →
  `https://api.hz.nknighta.me/v1/webhooks/clerk`.
- **`apps/hazy`** / **`apps/hazy-note`** — `bun run cf:deploy --filter=<app>`,
  then `wrangler secret put …` for `DATABASE_URL` (hazy-note only),
  `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `OPENROUTER_API_KEY`
  (hazy-note only). `NEXT_PUBLIC_*` (incl. hazy's `NEXT_PUBLIC_API_URL`) are
  inlined at build from `apps/<app>/.env.local` — the `wrangler.jsonc` `vars`
  mirror them for reference / server-side reads.

`apps/api` and hazy-note reach the database over `@repo/db`'s Neon HTTP driver
(Workers has no raw TCP). Locally, a `127.0.0.1` `DATABASE_URL` transparently
switches to the postgres.js TCP driver instead; `apps/api` dev also runs on Node
(not workerd) so that path just works.
