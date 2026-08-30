# hazy

Save URLs, search your reading, ask questions about it, catch up on a
read-later digest. Next 16 (App Router, Turbopack, React Compiler) +
next-intl (en / ja) + Tailwind + shadcn/radix.

**hazy is a pure frontend.** The backend lives in `apps/api`
(`api.hz.nknighta.me`); every data call goes through `@repo/api-client`
(`useHazyClient()` in the react-query hooks under `src/hooks/`). This app
only needs Clerk (for `<ClerkProvider>` + the server-side redirect gate in
`src/app/[locale]/(app)/layout.tsx`) and `NEXT_PUBLIC_API_URL`.

## Dev

```bash
bun run dev --filter=hazy   # :3100 — needs apps/api on :8787
```

`apps/hazy/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3100
NEXT_PUBLIC_HAZY_NOTE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

## Deploy

OpenNext → Cloudflare Workers (`wrangler.jsonc`, `open-next.config.ts`).
`bun run cf:deploy --filter=hazy`. Set `NEXT_PUBLIC_API_URL=https://api.hz.nknighta.me`
as a Worker var. The cross-origin API call carries a Clerk session token as
`Authorization: Bearer`; `apps/api`'s CORS allowlist must include this app's
origin (`CORS_ALLOWED_ORIGINS`).

## Structure

- `src/hooks/use-*.ts` — react-query wrappers over `@repo/api-client`.
- `src/app/[locale]/**` — pages; only the two layout/gate files touch Clerk
  server-side, nothing reads the DB.
- `src/lib/env.ts` — the four `NEXT_PUBLIC_*` vars + the two Clerk keys.
- `src/middleware.ts` — Clerk context + next-intl locale routing.
