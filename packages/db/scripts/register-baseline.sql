-- Mark migration 0000_baseline as already-applied.
--
-- 0000_baseline recreates the tables `hazy` originally created via `db:push`
-- (users, saved_urls, collections, read_later_state, ask_*). On a database
-- that already has them it must be skipped, while 0001–0003 (the hazy-note
-- additions) still need to run.
--
-- drizzle's migrator decides what to run purely by comparing `created_at`
-- (the journal's `when`, in ms) against the newest row here. Insert a row
-- for 0000 and `bun run db:migrate` will apply only 0001, 0002, 0003.
--
-- Run this ONCE against such a database, before the first `bun run db:migrate`,
-- from packages/db/:
--
--   psql "$DATABASE_URL" -f scripts/register-baseline.sql
--
-- Safe to run again: the INSERT is guarded and does nothing if 0000 (or any
-- later migration) is already recorded.

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT
  'e82d70ea0565be0635c09fbd29899d8ae39e48da802fd5d597f5fc74674db4de',
  1787944616065
WHERE NOT EXISTS (SELECT 1 FROM drizzle."__drizzle_migrations");
