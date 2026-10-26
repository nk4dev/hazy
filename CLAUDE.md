# hazy-repo

Turborepo, bun workspaces. One product, one Clerk tenant, one database, one API.

| Package | What |
|---|---|
| `apps/api` | `hazy-api` — a **Hono Worker** at `api.hz.nknighta.me`. hazy's backend: `/v1/**` JSON API + the Clerk webhook. |
| `apps/hazy` | `hz.nknighta.me` — a **pure frontend** (Next 16, Turbopack). No backend, no DB. Calls `apps/api` via `@repo/api-client`. |
| `apps/hazy-note` | `note.hz.nknighta.me` — Next 16. Capture → notes (Quill editor) → search / analyze → export. **Still has its own `/api/*` route handlers** over `@repo/db` (migrating to `apps/api` is a follow-up). Search: client-side keyword/tag + on-device `@ternlight/base` semantic + an OpenRouter chat route. |
| `apps/hazy-dash` | `dash.hz.nknighta.me` — home-screen dashboard (Next 16, client-only) — weather (Open-Meteo), today's three, week stats, recent saves, quick save, inline Ask. A **connected app**: gets an `hz_…` token via "Connect with Hazy" (`/connector/add`) and calls `apps/api` with it; no Clerk, no DB. |
| `packages/api-client` | `@repo/api-client` — typed client (`createHazyClient` / `useHazyClient`) + the wire-contract DTO types. The single source of truth for the API shape. `docs/ai/flutter/` re-documents this surface by genre for the Flutter hazy app — keep it in sync when the contract changes. |
| `packages/db` | `@repo/db` — the one Drizzle schema + `getDb()` + migrations + search-vector trigger. |

## Rules

- **Package manager: `bun`.** `bun install` at the root, `bun add <pkg> --filter <app>`,
  `bun run <task>` (→ `turbo run`, `--filter=<name>` to scope). One `bun.lock` at the root.
- **Schema changes go in `packages/db/src/schema.ts` only.** Then `bun db:generate`
  (from `packages/db/`) + apply. There is no per-app schema.
- `apps/hazy` must never regain a `src/db` or `src/app/api` — data flows
  frontend → `@repo/api-client` → `apps/api`. Add API methods to
  `packages/api-client/src/client.ts` and the DTO to `src/types.ts`.
- Four Workers, four custom domains, deployed independently. See each app's
  README for the deploy + `wrangler secret put` steps. `apps/api` also needs the
  Clerk dashboard webhook pointed at `api.hz.nknighta.me/v1/webhooks/clerk`.
- `bun run dev` starts all four: api :8787 (Node, `@hono/node-server`),
  hazy-note :3000, hazy :3100, hazy-dash :3200. hazy needs `NEXT_PUBLIC_API_URL=http://localhost:8787`;
  hazy-dash defaults to the production hazy + API (its approval page and tokens live there).
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

## Connect with Hazy (branch `feat/connect`)

OAuth-style authorization-code + PKCE (S256) flow that lets third-party clients get a long-lived `hz_…` bearer token for the API. No client registration; the `redirect_uri` origin is the client's identity.

1. Client sends the user to `https://hz.nknighta.me/connector/add?client_name&redirect_uri&code_challenge&state` (no locale prefix needed; next-intl redirects to `/en|ja/connector/add` keeping the query).
2. Signed-in user approves → `POST /v1/connect/authorize` → `{ code }` (5-minute TTL).
3. hazy redirects to `redirect_uri?code&state`.
4. Client calls the public `POST /v1/connect/token` with `code`, `codeVerifier`, `redirectUri` → `{ accessToken, tokenType: "Bearer", clientName }`.

| Piece | Where |
|---|---|
| Routes: `connect` (authed: `POST /authorize`, `GET /apps`, `DELETE /apps/:id`) and `connectToken` (public) | `apps/api/src/routes/connect.ts`, mounted in `app.ts` |
| Token helpers: `API_TOKEN_PREFIX`, `randomSecret`, `sha256Hex`, `pkceChallenge`, `resolveApiToken`, `isConnectedOrigin` | `apps/api/src/lib/auth/api-token.ts` |
| Tables `connect_codes`, `api_tokens` (SHA-256 hashes only) | `packages/db/src/schema.ts`, migration `0008_high_katie_power` |
| Client methods `connect.authorize / apps / revoke`; DTOs `ConnectCodeDTO`, `ConnectedAppDTO`, `ConnectTokenDTO` | `packages/api-client` |

- `authMiddleware` treats any bearer starting with `hz_` as a connected-app token and sets `authVia: "api_token"`; anything else is a Clerk JWT (`authVia: "clerk"`). `/v1/connect/token` is exempt from auth like the webhook.
- `connect` routes require `authVia === "clerk"` — a connected app gets 403 and can't mint or revoke tokens.
- Codes are single-use: deleted on read even if the checks fail. Mismatched `redirectUri` or PKCE verifier → `400 invalid_grant`.
- `redirect_uri` must be https (http only for `localhost`, `127.0.0.1`, `[::1]`) with no fragment.
- CORS: besides `allowedOrigins()`, `/v1/connect/token` accepts any origin, and any origin holding an unrevoked token is allowed (`isConnectedOrigin`).
- `last_used_at` is written at most once an hour.

Web UI in `apps/hazy`: approval page `src/components/connect/connect-approval-view.tsx` at `/[locale]/connector/add` (route group `(connect)`; bare `/connector` redirects to `/settings/connections`, signed-out users bounce through `/sign-in?redirect_url=` with the PKCE query preserved), and the list/revoke screen at `/settings/connections` (`settings/connected-apps-view.tsx`, hooks in `src/hooks/use-connected-apps.ts`).

Remote debugging: `~/.cloudflared/config.yml` routes `pctunnel.nknighta.me` → `localhost:3100` on tunnel `nk4dev-pc-test`; run `bun run dev` and `bun run dev:tunnel` in `apps/hazy` (`allowedDevOrigins` is set in `next.config.ts`).

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
