@AGENTS.md

# hazy is a pure frontend (React + Vite SPA)

The backend lives in **`apps/api`** (`api.hz.nknighta.me`). This app has **no
`src/db`, no `src/app/api`, no Drizzle / OpenRouter / cheerio deps**. Every data
call goes through `@repo/api-client`:

- `src/lib/clients.ts` configures `apiClient` (`createHazyClient` with `credentials: "include"`), `authClient` (`createHazyAuthClient` for Better Auth), `hazyQueries` (`createHazyQueryOptions`), and `queryClient` (`createAppQueryClient` with `onUnauthorized` session/cache clearing).
- `src/components/providers/auth-provider.tsx` tracks session state (`authSessionQueryOptions`), clears TanStack Query caches on sign-out or user change, and handles `signOut()`.
- `src/router.tsx` (`@tanstack/react-router`) provides route-level `beforeLoad` auth guards, `loader` prefetching, `defaultPreload: "intent"`, and lazy code-split page modules under `src/pages/*-page.tsx`.
- Hooks in `src/hooks/use-*.ts` wrap `hazyQueries` and mutations with cache invalidation and optimistic updates (`useItem`, `useReadLater`, etc.).
- New endpoint? Add the method to `packages/api-client/src/client.ts`, query options to `packages/api-client/src/query.ts`, and DTOs to `packages/api-client/src/types.ts`, then implement the route in `apps/api/src/routes/`.
- Routing & i18n: `@tanstack/react-router` (`src/router.tsx`, `src/i18n/navigation.tsx`) + `react-i18next` (`src/i18n/index.ts`, `messages/en.json`, `messages/ja.json`).
- `src/lib/env.ts` reads `VITE_*` (with `NEXT_PUBLIC_*` fallback) via `import.meta.env`.

# Monorepo

`apps/hazy` in a Turborepo (`hazy-repo/`). Schema + DB client + migrations are in
`packages/db` (`@repo/db`) — but this app doesn't import them. UI components and Nocturne theme live in `packages/ui` (`@repo/ui`).

# Package manager

`bun`, not npm/yarn. `bun install` at the repo root, `bun add <pkg> --filter hazy`,
`bun run <task>` (→ `turbo`, `--filter=hazy` to scope). One `bun.lock` at the root.

# Deploy

Vite `dist/` → Cloudflare Workers Static Assets (`wrangler.jsonc`, custom domain
`hz.nknighta.me`, `not_found_handling: "single-page-application"`).
`public/_headers` sets `frame-ancestors 'none'` / `X-Frame-Options: DENY` on
`/connector/add` and `/*/connector/add`.
