# @repo/db

The one Drizzle schema for the whole repo (`apps/hazy` no longer imports it;
`apps/api` and `apps/hazy-note` do). See `README.md`.

# Rules

- **Change `src/schema.ts` once, here.** No per-app schema. Then from
  `packages/db/`: `bun db:generate` → a new `migrations/000N_*.sql`.
- `bun db:push` is **interactive** (prompts on constraint reorders) → it hangs in
  a non-TTY shell. For scripted/CI application use `bun db:migrate` or apply the
  SQL files with `psql -1 -f`.
- `DATABASE_URL` comes from `packages/db/.env.local` (gitignored; the Neon URL is
  a commented line there). Point it at whichever DB you're migrating.
- The Neon (production) database and the local dev DB can drift — verify with
  `psql "<url>" -c "\dt"` before assuming a migration landed. Migrations are all
  additive; `sql/search-vector-trigger.sql` is applied out of band (`bun db:trigger`).
- `getDb()` (`src/client.ts`): postgres.js for `localhost`/`127.0.0.1`, Neon HTTP
  driver otherwise. `DeltaOp` (`src/delta.ts`) types `notes.body`.
