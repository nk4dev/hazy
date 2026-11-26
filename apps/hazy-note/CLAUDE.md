@AGENTS.md

# hazy-note

`note.hz.nknighta.me` — **React 19 + Vite SPA** + **TanStack Router** + **TanStack Query** + **Better Auth**. Capture → notes → analyze → export.
(`/graph` "つながり" and `/compare` "比較ボード" were removed — the `graph_snapshots` and `compare_boards` tables stay in `@repo/db` but nothing reads them.)

# UI: shared Nocturne (`@repo/ui`) + app styles

The app's look extends the shared **Nocturne** design system (`@repo/ui/styles.css`) in `src/styles/globals.css`, keeping component classes (`.btn` / `.card` / `.tag` / `.seg` / `.table`), `.density-compact`, `components/ui.tsx` (`Button` / `Tag` / `Seg`), and **shadcn/ui** (`components/ui/*`, `lib/utils.ts`). `<html class="dark">` keeps shadcn components on their dark palette.

# Backend & Auth

- **Pure frontend:** all data and AI endpoints live in **`apps/api`** under `/v1/note/**`, accessed via `@repo/api-client` (`lib/clients.ts` `noteApiClient` & `lib/api.ts`). There is no `app/api/*`, no `@repo/db` import, and no Drizzle dependency here.
- **Better Auth:** `noteAuthClient` (`@repo/api-client/auth`) shares `.hz.nknighta.me` `HttpOnly` session cookies (`credentials: "include"`). `src/components/auth-provider.tsx` and `src/router.tsx` (`beforeLoad` guards, `/sign-in`, `/sign-up`, `onUnauthorized` handler) clear TanStack Query caches on sign-out, `401`, or user switch.
- **TanStack Router & Query:** `src/router.tsx` defines lazy code-split routes (`src/pages/*-page.tsx`), `defaultPreload: "intent"`, and `loader` prefetching using `noteQueries` (`createHazyQueryOptions`); `lib/hooks.ts` exports query and mutation hooks with cache invalidation and optimistic deletes.

# Projects

A "プロジェクト" lives in `@repo/db`'s `projects` table (served via `/v1/note/projects/*`) — separate from hazy's `collections`. `/projects/$id` shows `description`, sources (`saved_urls.project_id`), and notes (`notes.project_id`). There is **no** tag-based auto-creation, auto-sort, or digest (`notes.collection_id` / `compare_boards.*` are dead). `/analyze` also accepts `?project=<id>`.

# Tags (`/tags`) + breadcrumbs

`/tags` calls `/v1/note/tags` (`Tag.urlCount` / `Tag.noteCount`). Clicking a tag navigates to `/library?tag=` when it has URLs, else `/notes?tag=`. `BreadcrumbProvider` wraps `AppShell`, and detail pages call `useBreadcrumb([{ label }])`.

# Search (`/search`)

`lib/search.ts` is pure and shared: `buildCorpus(notes, items)` flattens notes + non-note sources to `SearchDoc[]`; `textSearch` / `tagSearch` / `rankBySimilarity` do ranking. Four modes:

- **文字列 / タグ / AI検索** run client-side on `/search`. AI検索 lazy-`import()`s `@ternlight/base/web` (~7 MB WASM MiniLM embedder), embeds the corpus + query, and ranks by cosine (`vite.config.ts` sets `optimizeDeps: { exclude: ["@ternlight/base"] }` so WASM loads cleanly in Vite).
- **チャット** → `POST /v1/note/search/chat` via `@repo/api-client`. Stateless — no `ask_*` rows.

# The note editor

`/notes/$id` (and `/notes/new` draft) uses **Quill 2** (`components/note-editor.tsx`, bubble theme). Body is stored as a Quill **Delta** in `notes.body` (`jsonb` `ops` array). `lib/note-delta.ts` imports `NoteDeltaOp` from `@repo/api-client` (no `@repo/db` dependency). `notes.blocks` is legacy. `@`-mention inserts a link + registers a source in `notes.sources`, using a deferred `setTimeout(..., 0)` tick around `quill.getSelection()`.

# Rules

- `bun`, not npm/yarn. `bun add <pkg> --filter hazy-note`. One `bun.lock` at the root.
- Backend API/schema changes → `packages/db`, `packages/api-client`, and `apps/api`.
- Local dev DB: `scripts/localdb.sh` (`127.0.0.1:5433`, used by `apps/api`).
- Deploy: Vite `dist/` → Cloudflare Workers Static Assets (`wrangler.jsonc`, `not_found_handling: "single-page-application"`).
- Tests: `bun --filter hazy-note test` (`lib/search.test.ts`), `check-types`, `lint`, `build`.
