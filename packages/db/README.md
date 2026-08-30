# @repo/db

The one Drizzle schema + client for the whole repo. `apps/hazy` and
`apps/hazy-note` are two views of the same product — same Clerk tenant, same
database — so there is a single schema here, not one per app.

## Layout

| Path | What |
|---|---|
| `src/schema.ts` | Every table, enum and relation. The read-later core (`users`, `saved_urls`, `collections`, `read_later_state`, `ask_*`) plus hazy-note's additions (`source_kind` / `note_status` enums; extra `saved_urls` / `collections` columns; `notes` / `compare_boards` / `graph_snapshots`). |
| `src/client.ts` | `getDb(url?)` — lazy, self-caching. Picks **postgres.js** (TCP) for a `localhost` / `127.0.0.1` URL and **Neon's HTTP driver** for anything else. The HTTP branch is what lets both apps run on Cloudflare Workers, which has no raw TCP sockets. |
| `src/connection-options.ts` | `isLocalDatabaseUrl`, `resolveSslMode`. |
| `migrations/` | drizzle-kit migrations `0000`–`0005` + `meta/`. `0005` adds `notes.body` (Quill Delta) + `notes.suggestions`. |
| `sql/search-vector-trigger.sql` | Keeps `saved_urls.search_vector` populated (drizzle-kit can't express a trigger). |

Consumed as `@repo/db` / `@repo/db/schema` / `@repo/db/client`. It's a JIT
package (exports `.ts`) — each app's bundler compiles it, no build step.

## How the apps use it

- **hazy** — `apps/hazy/src/db/index.ts` wraps `getDb` with hazy's "boot with no
  keys" check; `apps/hazy/src/db/schema.ts` re-exports `@repo/db/schema` so the
  ~20 `@/db/schema` imports keep working.
- **hazy-note** — `apps/hazy-note/lib/db/index.ts` is `export const db = getDb()`.
  `repo.ts` / `current-user.ts` / `seed.ts` query it directly.

Both resolve the signed-in Clerk user to a `users` row by `clerk_id`; same Clerk
instance → same `users.id` → `saved_urls` / `collections` are shared. A URL saved
in hazy shows up in hazy-note's library and vice versa.

**Change the schema once, here.** There is no second file to keep in sync.

## Scripts (run from `packages/db/`)

`DATABASE_URL` comes from `packages/db/.env.local` (gitignored — the Next apps
use their own `apps/*/.env.local`). Point it at whichever database you're
migrating.

| Command | What |
|---|---|
| `bun db:generate` | Diff `schema.ts` against the migration snapshots → new SQL. |
| `bun db:migrate` | Apply pending migrations (tracked in `drizzle.__drizzle_migrations`). |
| `bun db:push` | Push the schema straight to the DB (no migration file). |
| `bun db:trigger` | (Re-)apply `sql/search-vector-trigger.sql`. |
| `bun db:studio` | Drizzle Studio. |

### First migrate against a database hazy already `db:push`-ed

`0000_baseline` recreates the tables hazy made by hand, so on such a database it
must be skipped while `0001`+ still run:

```bash
psql "$DATABASE_URL" -f scripts/register-baseline.sql   # once
bun db:migrate
```

drizzle decides what to run by comparing `created_at` (ms); the script seeds a
row for `0000` (`1787944616065`) so only later migrations apply.

### Rollback (hazy-note additions are all additive)

```sql
ALTER TABLE notes DROP COLUMN IF EXISTS body, DROP COLUMN IF EXISTS suggestions;  -- 0005
DROP TABLE IF EXISTS graph_snapshots, compare_boards, notes CASCADE;
ALTER TABLE saved_urls
  DROP COLUMN IF EXISTS kind, DROP COLUMN IF EXISTS points,
  DROP COLUMN IF EXISTS suggested_tags, DROP COLUMN IF EXISTS duration_label,
  DROP COLUMN IF EXISTS quote_candidates, DROP COLUMN IF EXISTS related_note_id,
  DROP COLUMN IF EXISTS summary_lines;
ALTER TABLE collections DROP COLUMN IF EXISTS tone;
DROP TYPE IF EXISTS note_status;
DROP TYPE IF EXISTS source_kind;
DELETE FROM drizzle."__drizzle_migrations" WHERE created_at > 1787944616065;
```

`users` / `saved_urls` / `collections` data is untouched.
