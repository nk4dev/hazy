@AGENTS.md

# hazy is a pure frontend

The backend lives in **`apps/api`** (`api.hz.nknighta.me`). This app has **no
`src/db`, no `src/app/api`, no Drizzle / OpenRouter / cheerio deps**. Every data
call goes through `@repo/api-client`:

- react-query hooks in `src/hooks/use-*.ts` call `useHazyClient()`
  (`@repo/api-client/react`), which is `createHazyClient` wired to
  `useAuth().getToken()` and `NEXT_PUBLIC_API_URL`.
- New endpoint? Add the method to `packages/api-client/src/client.ts` and the
  DTO to `packages/api-client/src/types.ts`, implement the route in
  `apps/api/src/routes/`. Don't add a fetch or a route handler here.
- Only two server files touch auth: `src/app/[locale]/page.tsx` and
  `src/app/[locale]/(app)/layout.tsx` — a Clerk `auth()` redirect gate, no DB.
- `src/lib/env.ts` is down to four `NEXT_PUBLIC_*` vars + the two Clerk keys.

# Monorepo

`apps/hazy` in a Turborepo (`hazy-repo/`). Schema + DB client + migrations are in
`packages/db` (`@repo/db`) — but this app doesn't import them.

# Package manager

`bun`, not npm/yarn. `bun install` at the repo root, `bun add <pkg> --filter hazy`,
`bun run <task>` (→ `turbo`, `--filter=hazy` to scope). One `bun.lock` at the root.

# Deploy

OpenNext → Cloudflare Worker `hazy`. `NEXT_PUBLIC_*` (incl. `NEXT_PUBLIC_API_URL`)
are inlined at build from `.env.local`; `wrangler.jsonc` `vars` mirror them.
