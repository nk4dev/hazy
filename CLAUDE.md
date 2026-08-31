# hazy-repo

Turborepo, bun workspaces. One product, one Clerk tenant, one database, one API.

| Package | What |
|---|---|
| `apps/api` | `hazy-api` — a **Hono Worker** at `api.hz.nknighta.me`. hazy's backend: `/v1/**` JSON API + the Clerk webhook. |
| `apps/hazy` | `hz.nknighta.me` — a **pure frontend** (Next 16, Turbopack). No backend, no DB. Calls `apps/api` via `@repo/api-client`. |
| `apps/hazy-note` | `note.hz.nknighta.me` — Next 16. Capture → notes (Quill editor) → search / analyze → export. **Still has its own `/api/*` route handlers** over `@repo/db` (migrating to `apps/api` is a follow-up). Search: client-side keyword/tag + on-device `@ternlight/base` semantic + an OpenRouter chat route. |
| `packages/api-client` | `@repo/api-client` — typed client (`createHazyClient` / `useHazyClient`) + the wire-contract DTO types. The single source of truth for the API shape. |
| `packages/db` | `@repo/db` — the one Drizzle schema + `getDb()` + migrations + search-vector trigger. |

## Rules

- **Package manager: `bun`.** `bun install` at the root, `bun add <pkg> --filter <app>`,
  `bun run <task>` (→ `turbo run`, `--filter=<name>` to scope). One `bun.lock` at the root.
- **Schema changes go in `packages/db/src/schema.ts` only.** Then `bun db:generate`
  (from `packages/db/`) + apply. There is no per-app schema.
- `apps/hazy` must never regain a `src/db` or `src/app/api` — data flows
  frontend → `@repo/api-client` → `apps/api`. Add API methods to
  `packages/api-client/src/client.ts` and the DTO to `src/types.ts`.
- Three Workers, three custom domains, deployed independently. See each app's
  README for the deploy + `wrangler secret put` steps. `apps/api` also needs the
  Clerk dashboard webhook pointed at `api.hz.nknighta.me/v1/webhooks/clerk`.
- `bun run dev` starts all three: api :8787 (Node, `@hono/node-server`),
  hazy-note :3000, hazy :3100. hazy needs `NEXT_PUBLIC_API_URL=http://localhost:8787`.
- **Keep agent-facing docs in sync in the same change.** Any spec/behaviour
  change — a route added or removed, a nav item, an API endpoint, a schema
  table, a workflow step — must update the affected `CLAUDE.md` (root +
  per-app) and the app's `README.md` in the same commit, not as a follow-up.
  Removed-but-retained tables/columns get a one-line "dead, nothing reads it"
  note rather than silent deletion.

## Database

`getDb()` picks the driver from the URL: postgres.js (TCP) for
`localhost` / `127.0.0.1`, Neon's HTTP driver otherwise (Workers has no raw TCP).
Local dev DB: `apps/hazy-note/scripts/localdb.sh` (user-owned PG 18 on
`127.0.0.1:5433`). The Neon database is the production one — all three apps share it.

## Browser testing — `agent-browser`

`agent-browser` (vercel-labs, a root devDep) drives a real Chrome for verifying
the UIs. The skill (`.agents/skills/agent-browser`, installed via
`bunx skills add vercel-labs/agent-browser`) has the full guide. Config:
`agent-browser.json` at the root (`--no-sandbox` — required here). Typical loop:

```bash
bunx agent-browser batch "open http://localhost:3000/notes" "snapshot -i"
bunx agent-browser click @e3
bunx agent-browser screenshot /tmp/x.png
```

Chrome lives in `~/.agent-browser/` (not the repo). Use it to check a page after
a UI change instead of only `curl`-ing status codes.
