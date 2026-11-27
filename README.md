# hazy

Turborepo for **hazy**, **hazy-note**, and **hazy-dash** — one product, **Better Auth** (GitHub OAuth + Passkeys) + `hz_` API tokens, one database, one API.

**Overview / showcase:** https://apps.nknighta.me/hazy/ (`docs/`, GitHub Pages) —
what it is, the architecture, and the AI-native toolchain it's built with.

| | |
|---|---|
| `apps/hazy` | Save URLs, search your reading, ask questions about it, read-later digest. Pure frontend (React 19 + Vite SPA, TanStack Router/Query, `react-i18next` en/ja) — talks to `apps/api`. |
| `apps/hazy-note` | Turn saved URLs into your own writing: capture → organise → notes (Quill 2 editor) → analyze → export. Pure frontend (React 19 + Vite SPA, TanStack Router/Query) — talks to `apps/api` (`/v1/note/**`). |
| `apps/hazy-dash` | Home-screen dashboard — weather, today's reading, recent saves, quick save, Ask. Connects to Hazy via "Connect with Hazy" (`hz_` token). Live at `dash.hz.nknighta.me` (dev `:3200`). |
| `apps/api` | The hazy backend — a **Hono Worker** for `api.hz.nknighta.me`. Serves `/api/auth/**` (Better Auth) + `/v1/**` JSON API. See `apps/api/README.md`. |
| `packages/api-client` | `@repo/api-client` — typed client (`createHazyClient`), Better Auth client (`@repo/api-client/auth`), shared TanStack Query helpers (`@repo/api-client/query`), and wire-contract DTOs. |
| `packages/db` | `@repo/db` — the single Drizzle schema + client + migrations + search-vector trigger. See `packages/db/README.md`. |
| `packages/ui` | `@repo/ui` — shared Nocturne Tailwind v4 theme + shadcn/ui & common components (`HazyMark`, `Favicon`). |

## Prerequisites (1Password CLI Required)

**This repository requires the [1Password CLI (`op`)](https://developer.1password.com/docs/cli/) for secret management.**
Plaintext secrets must never be written to `.env`, `.env.local`, `.dev.vars`, or `wrangler.jsonc`.

- Create gitignored `.env.op` (local dev) and `.env.prod.op` (production Neon migrations) using `.env.example` as a reference, with `op://<Vault>/<Item>/<Field>` references.
- Inject secrets in memory via `op run`:

```bash
bun install

# Local dev (uses local PG 18 on 127.0.0.1:5433 via .env.op)
op run --env-file=".env.op" -- bun run dev     # api :8787, hazy-note :3000, hazy :3100, hazy-dash :3200
```

Local Postgres for development: `apps/hazy-note/scripts/localdb.sh start`
(user-owned PG on `127.0.0.1:5433`, no Docker). Then:

```bash
op run --env-file=".env.op" -- bun --filter @repo/db db:migrate
op run --env-file=".env.op" -- bun --filter @repo/db db:trigger
```

## Tasks (`bun run <task>` at the root → `turbo run`)

| Task | |
|---|---|
| `dev` | All dev servers (`--filter=<app>` for one). `api` runs on Node (`@hono/node-server`); `hazy` / `hazy-note` / `hazy-dash` on Vite |
| `build` | Production builds across all apps |
| `lint` | Biome |
| `check-types` | `tsc --noEmit` across every package |
| `deploy` / `preview` | `apps/api` — `wrangler deploy` / `wrangler dev` |
| `cf:build` / `cf:deploy` | `apps/hazy` / `apps/hazy-note` / `apps/hazy-dash` — Vite `dist/` → Cloudflare Workers Static Assets |
| `db:generate` / `db:migrate` / `db:push` / `db:trigger` / `db:studio` | `@repo/db` |

## Deploy

Four independent Cloudflare Workers on custom domains (`api.hz.nknighta.me`, `hz.nknighta.me`, `note.hz.nknighta.me`, `dash.hz.nknighta.me`).

- **`apps/api`**: `bun run deploy --filter=api` and register production secrets from 1Password (`op read ... | bunx wrangler secret put <KEY> --cwd apps/api`) for `DATABASE_URL` (Neon `production`), `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `OPENROUTER_API_KEY`.
- **Frontend SPAs (`hazy`, `hazy-note`, `hazy-dash`)**: `bun run cf:deploy --filter=<app>` (Cloudflare Workers Static Assets).

`getDb()` in `@repo/db` automatically selects `postgres.js` (TCP) for `localhost` / `127.0.0.1` (local dev) and `@neondatabase/serverless` (HTTP) for Neon in production.
