@AGENTS.md

# hazy is a pure frontend (React + Vite SPA)

The backend lives in **`apps/api`** (`api.hz.nknighta.me`). This app has **no
`src/db`, no `src/app/api`, no Drizzle / OpenRouter / cheerio deps**. Every data
call goes through `@repo/api-client`:

- `ClerkHazyClientProvider` (`src/components/providers/clerk-hazy-client-provider.tsx`)
  wires `<HazyClientProvider>` (`@repo/api-client/react`) to `@clerk/clerk-react`'s
  `useAuth().getToken()` and `env.API_URL`.
- react-query hooks in `src/hooks/use-*.ts` call `useHazyClient()`.
- New endpoint? Add the method to `packages/api-client/src/client.ts` and the
  DTO to `packages/api-client/src/types.ts`, implement the route in
  `apps/api/src/routes/`. Don't add a fetch or a route handler here.
- Routing & i18n: `react-router` (`src/App.tsx`, `src/i18n/navigation.tsx`) +
  `react-i18next` (`src/i18n/index.ts`, `messages/en.json`, `messages/ja.json`).
- `src/lib/env.ts` reads `VITE_*` (with `NEXT_PUBLIC_*` fallback) via `import.meta.env`.

# Monorepo

`apps/hazy` in a Turborepo (`hazy-repo/`). Schema + DB client + migrations are in
`packages/db` (`@repo/db`) — but this app doesn't import them.

# Package manager

`bun`, not npm/yarn. `bun install` at the repo root, `bun add <pkg> --filter hazy`,
`bun run <task>` (→ `turbo`, `--filter=hazy` to scope). One `bun.lock` at the root.

# Deploy

Vite `dist/` → Cloudflare Workers Static Assets (`wrangler.jsonc`, custom domain
`hz.nknighta.me`, `not_found_handling: "single-page-application"`).
`public/_headers` sets `frame-ancestors 'none'` / `X-Frame-Options: DENY` on
`/connector/add` and `/*/connector/add`.
