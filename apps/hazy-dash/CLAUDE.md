# hazy-dash

A home-screen dashboard for Hazy (Next 16, `:3200`), deployed at `dash.hz.nknighta.me`. Everything renders on the
client; there are no route handlers, no Clerk and no DB.

- **It is a connected app, not a hazy session.** `src/lib/connect.ts` runs the
  "Connect with Hazy" flow: PKCE (S256) → `${NEXT_PUBLIC_HAZY_URL}/connector/add`
  → `/callback?code&state` → public `POST /v1/connect/token` → an `hz_…` token in
  `localStorage`. `redirect_uri` must be byte-identical in both steps (the API
  compares strings) and use `localhost`, not `127.0.0.1` (CORS is granted by the
  origin stored with the token). Codes are single-use; `completeConnect` runs once
  per page load because StrictMode mounts effects twice.
- Data: `createHazyClient` from `@repo/api-client` with the stored token. Don't
  import `@repo/api-client/react` — it needs Clerk. A 401 clears the token
  (revoked in hazy → Settings → Connected apps). The dash can't revoke its own
  token: `hz_…` tokens get 403 on `/v1/connect/*`, so "disconnect" only forgets it.
- Weather: Open-Meteo, no key (`src/lib/weather.ts`). Place from geolocation or a
  city search, kept in `localStorage`.
- Strings: `src/lib/i18n.ts` (en/ja by browser language). Theme/utilities in
  `src/app/globals.css` are copied from `apps/hazy` — keep them in sync.
- Defaults to the **production** hazy + API (`.env.example`); the approval page and
  the `connect_codes` / `api_tokens` tables only exist there.
- Remote debugging: `pctunnel-dash.nknighta.me` → `localhost:3200` on the
  `nk4dev-pc-test` tunnel (`allowedDevOrigins`, `no-store` + per-start
  `deploymentId` in `next.config.ts`). Connecting from there makes the tunnel
  origin the token's `clientOrigin`, so it gets its own token.
- Deploy: OpenNext → Cloudflare Worker `hazy-dash` (`wrangler.jsonc`, custom domain
  `dash.hz.nknighta.me`). `bun run cf:build && bun run cf:deploy` from this directory;
  no secrets or vars needed (production URLs are the defaults in `src/lib/env.ts`).

`bun run dev --filter=hazy-dash`, `bun run test` (PKCE vector), `check-types`, `lint`.
Fonts come from a Google Fonts `<link>` in `layout.tsx`, not `next/font`: the
`next/font/google` Turbopack dev loader failed intermittently here.

`github.com/nk4dev/hazy-dash` is an export of this directory, not a second
source: edit here. `.github/workflows/export-hazy-dash.yml` copies the tracked
files over and pushes on every master push that touches `apps/hazy-dash/**`
(deploy key secret `HAZY_DASH_DEPLOY_KEY`; also runnable by hand).
