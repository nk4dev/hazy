# hazy

Save URLs, search your reading, ask questions about it, catch up on a read-later digest.
**React 19 + Vite SPA** + **TanStack Router** + **TanStack Query** + `react-i18next` (`en` / `ja`) + Tailwind v4 (`@repo/ui` Nocturne).

**hazy is a pure frontend.** The backend lives in `apps/api` (`api.hz.nknighta.me`);
every data call goes through `@repo/api-client` using Better Auth `HttpOnly` cross-subdomain cookies (`credentials: "include"`).

## Dev

```bash
bun run dev --filter=hazy   # :3100 — needs apps/api on :8787
```

Non-secret local defaults work out of the box (`VITE_API_URL=http://localhost:8787`, `VITE_HAZY_NOTE_URL=http://localhost:3000`).

## Deploy

Vite `dist/` → Cloudflare Workers Static Assets (`wrangler.jsonc`, `not_found_handling: "single-page-application"`).
`bun run cf:deploy --filter=hazy`. Set `VITE_API_URL=https://api.hz.nknighta.me` in `wrangler.jsonc`.
Because requests send Better Auth cookies cross-origin to `api.hz.nknighta.me`, `apps/api`'s `CORS_ALLOWED_ORIGINS` must include `https://hz.nknighta.me`.

## Structure

- `src/lib/clients.ts` — shared `apiClient`, `authClient`, `hazyQueries`, and `queryClient` (`401` cache clearing).
- `src/router.tsx` & `src/pages/*-page.tsx` — TanStack Router route tree with `beforeLoad` session gates, `loader` prefetching, and lazy page code-splitting.
- `src/hooks/use-*.ts` — TanStack Query hooks + optimistic mutations over `@repo/api-client`.
- `src/components/providers/auth-provider.tsx` — Better Auth session sync & sign-out cache clear.
- `public/_headers` — `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` on `/connector/add` and `/*/connector/add`.
