#!/usr/bin/env bash
# Local Postgres for testing — a user-owned PG 18 instance, no sudo, no Docker.
# Runs on 127.0.0.1:5433 so it never collides with the system cluster on 5432.
#
#   scripts/localdb.sh start | stop | status | reset | psql
#
# Point .env.local at it with:
#   DATABASE_URL=postgresql://hazy@127.0.0.1:5433/hazy
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/18/bin}"
PGDATA="${HAZY_PGDATA:-$HOME/.local/share/hazy-pgdata}"
PORT=5433
SOCKDIR=/tmp/hazy-pg-sock

start() {
  mkdir -p "$SOCKDIR"
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$(dirname "$PGDATA")"
    "$PGBIN/initdb" -D "$PGDATA" -U hazy --auth=trust --encoding=UTF8 --locale=C >/dev/null
  fi
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "already running"
  else
    "$PGBIN/pg_ctl" -D "$PGDATA" -w \
      -o "-p $PORT -k $SOCKDIR -c listen_addresses=127.0.0.1" \
      -l "$PGDATA/server.log" start
  fi
  "$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U hazy hazy 2>/dev/null || true
  echo "postgresql://hazy@127.0.0.1:$PORT/hazy"
}

stop() { "$PGBIN/pg_ctl" -D "$PGDATA" -w stop; }
status() { "$PGBIN/pg_ctl" -D "$PGDATA" status; }
reset() {
  stop || true
  rm -rf "$PGDATA"
  start
}
shell() { "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U hazy -d hazy; }

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  reset) reset ;;
  psql) shell ;;
  *) echo "usage: $0 {start|stop|status|reset|psql}" >&2; exit 1 ;;
esac
