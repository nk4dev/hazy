-- Run once after `npm run db:push` (or via `npm run db:trigger`, which wraps
-- this file). drizzle-kit push manages the plain `search_vector tsvector`
-- column and its GIN index declared in schema.ts, but it can't express
-- "keep this column populated" — that's this trigger's job.
create or replace function saved_urls_search_vector_update() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, ARRAY[]::text[]), ' ')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.extracted_text, '')), 'C');
  return new;
end
$$ language plpgsql;

drop trigger if exists saved_urls_search_vector_trigger on saved_urls;
create trigger saved_urls_search_vector_trigger
  before insert or update of title, description, summary, extracted_text, tags
  on saved_urls
  for each row
  execute function saved_urls_search_vector_update();

-- Backfill any existing rows (no-op on a fresh table).
update saved_urls set search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(extracted_text, '')), 'C');
