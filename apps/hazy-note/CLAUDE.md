# hazy-note

`note.hz.nknighta.me` — Next 16 (App Router, Turbopack). Capture → notes →
compare → export. See `README.md`. (`/graph` "つながり" was removed — the
`graph_snapshots` table stays in `@repo/db` but nothing reads it.)

# Backend

Unlike `apps/hazy`, this app **still has its own `/app/api/*` route handlers**
over `@repo/db` (`lib/db/repo.ts` is the data layer, scoped by the internal
`users.id` from `lib/db/current-user.ts`). Moving it behind `apps/api` is a
follow-up — for now, edit the routes + `repo.ts` here.

# Projects

A "プロジェクト" is a `collections` row the user **creates deliberately** as a
workspace to develop an idea — `/projects/[id]` shows its `description` (the
idea), the sources filed under it (`collection_items`, via
`updateItem(_, { projectId })`) and the notes under it (`notes.collectionId`).
There is **no** tag-based auto-creation or auto-sort (removed), and no digest.
`collections.tone` is now just a colour.

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
