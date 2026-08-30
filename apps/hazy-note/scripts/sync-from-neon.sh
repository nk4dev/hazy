#!/usr/bin/env bash
# Copy the Neon (production) database into the local dev DB — for working
# against real data. Data only: both databases must already be on the same
# schema (run the migrations first). The local DB is TRUNCATEd.
#
#   NEON_DATABASE_URL='postgresql://…neon.tech/neondb?sslmode=require' \
#     bun run db:sync-from-neon           # from the repo root or apps/hazy-note/
#   bun run db:sync-from-neon -y          # skip the prompt
#
# NEON_DATABASE_URL   required (or a `…neon.tech…` line in packages/db/.env.local)
# LOCAL_DATABASE_URL  default postgresql://hazy@127.0.0.1:5433/hazy
# -y                  skip the confirmation prompt
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/18/bin}"
LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://hazy@127.0.0.1:5433/hazy}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# --- resolve the Neon URL ---
NEON_URL="${NEON_DATABASE_URL:-}"
if [ -z "$NEON_URL" ] && [ -f "$REPO_ROOT/packages/db/.env.local" ]; then
  NEON_URL="$(grep -oE 'postgres(ql)?://[^ ]*neon\.tech[^ ]*' "$REPO_ROOT/packages/db/.env.local" | head -1 || true)"
fi
if [ -z "$NEON_URL" ]; then
  echo "error: set NEON_DATABASE_URL (or add a neon.tech line to packages/db/.env.local)" >&2
  exit 1
fi

# --- guard: never truncate a non-local database ---
case "$LOCAL_DATABASE_URL" in
  *@127.0.0.1[:/]*|*@localhost[:/]*) ;;
  *) echo "error: LOCAL_DATABASE_URL doesn't look local — refusing to truncate it: $LOCAL_DATABASE_URL" >&2; exit 1 ;;
esac

PSQL="$PGBIN/psql"
PG_DUMP="$PGBIN/pg_dump"
[ -x "$PSQL" ] || { PSQL=psql; PG_DUMP=pg_dump; }

count() { "$PSQL" "$1" -tAqc "$2" 2>/dev/null || echo "?"; }

echo "  from : ${NEON_URL%%\?*}  ($(count "$NEON_URL" "select count(*) from saved_urls") saved_urls)"
echo "  into : $LOCAL_DATABASE_URL  ($(count "$LOCAL_DATABASE_URL" "select count(*) from saved_urls") saved_urls — will be replaced)"

if [ "${1:-}" != "-y" ]; then
  read -r -p "TRUNCATE the local DB and load Neon's data? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "aborted"; exit 0; }
fi

DUMP="$(mktemp -t hazy-neon-XXXXXX.sql)"
trap 'rm -f "$DUMP"' EXIT

echo "· dumping Neon (data only)…"
"$PG_DUMP" "$NEON_URL" --data-only --schema=public --disable-triggers \
  --no-owner --no-privileges --no-comments -f "$DUMP"

echo "· truncating local…"
"$PSQL" "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "
  DO \$\$
  DECLARE t text;
  BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO t FROM pg_tables WHERE schemaname = 'public';
    IF t IS NOT NULL THEN EXECUTE 'TRUNCATE ' || t || ' RESTART IDENTITY CASCADE'; END IF;
  END \$\$;"

echo "· loading…"
"$PSQL" "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$DUMP"

echo "· done. row counts (local / Neon):"
for tbl in users saved_urls collections collection_items read_later_state \
           ask_threads ask_messages ask_message_citations notes; do
  printf '  %-22s %s / %s\n' "$tbl" \
    "$(count "$LOCAL_DATABASE_URL" "select count(*) from $tbl")" \
    "$(count "$NEON_URL" "select count(*) from $tbl")"
done
