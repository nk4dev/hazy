# hazy-note

`note.hz.nknighta.me` — Next 16 (App Router, Turbopack). Capture → notes →
compare → export. See `README.md`. (`/graph` "つながり" was removed — the
`graph_snapshots` table stays in `@repo/db` but nothing reads it.)

# UI: hand-rolled Nocturne + shadcn/ui

The app's own look is the **Nocturne** design system — the `@theme` tokens
(`--color-accent` etc.) and `.btn` / `.card` / `.tag` component classes in
`app/globals.css`, plus `components/ui.tsx` (`Button` / `Tag` / `Seg`). That is
what every existing screen uses; keep using it.

**shadcn/ui** is also set up (preset `base-lyra`, `@base-ui/react`, hugeicons):
`components.json`, `components/ui/*`, `lib/utils.ts` `cn()`. `bunx shadcn add
<name>` for new primitives. Its token layer (`@theme inline` + `.dark` in
globals.css) is namespaced (`--background`, `--primary`, …) and does **not**
touch Nocturne's `--color-accent` / `--radius-{sm,md,lg}`. `<html class="dark">`
keeps shadcn components on their dark palette. `components/ui/**` +
`lib/utils.ts` are excluded from Biome (shadcn's own formatting).

# Backend

Unlike `apps/hazy`, this app **still has its own `/app/api/*` route handlers**
over `@repo/db` (`lib/db/repo.ts` is the data layer, scoped by the internal
`users.id` from `lib/db/current-user.ts`). Moving it behind `apps/api` is a
follow-up — for now, edit the routes + `repo.ts` here.

# Projects

A "プロジェクト" lives in hazy-note's **own `projects` table** (`@repo/db`) —
separate from hazy's `collections`. The user creates one deliberately as a
workspace to develop an idea: `/projects/[id]` shows its `description`, the
sources filed under it (`saved_urls.project_id`, set via
`updateItem(_, { projectId })`) and the notes under it (`notes.project_id`).
There is **no** tag-based auto-creation, auto-sort or digest (all removed).
`notes.collection_id` / `compare_boards.collection_id` are dead columns.

# The note editor

`/notes/[id]` uses **Quill 2** (`components/note-editor.tsx`, bubble theme). The
body is a Quill **Delta** stored in `notes.body` (jsonb `ops` array).

- `lib/note-delta.ts` — `deltaToPlainText` / `deltaToMarkdown` / `deltaExcerpt` /
  `paragraphCount` / `legacyBlocksToDelta`. Anything that reads a note's text
  (`repo.ts` `buildGraph` / `buildExport`, the notes list) goes through these.
- `notes.blocks` is **legacy** — old notes convert to `body` on read (in
  `toNote`), persisted on the next save. Don't write `blocks`.
- `@`-mention in the editor inserts a link + registers a source in
  `notes.sources`. AI suggestions are `notes.suggestions` (sidebar), not body blocks.

# Rules

- `bun`, not npm/yarn. `bun add <pkg> --filter hazy-note`. One `bun.lock` at the root.
- Schema changes → `packages/db/src/schema.ts` only, then `bun db:generate`.
- Local dev DB: `scripts/localdb.sh` (`127.0.0.1:5433`). Deploy: OpenNext →
  Cloudflare Worker `hazy-note`; secrets via `wrangler secret put`.
