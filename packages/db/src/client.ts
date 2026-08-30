import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import {
  drizzle as drizzlePostgresJs,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isLocalDatabaseUrl, resolveSslMode } from "./connection-options";
import * as schema from "./schema";

// Both drivers expose the same drizzle query-builder surface for everything
// these apps do; the concrete generic differs only in the raw `.execute()`
// result shape (postgres.js returns an array, neon-http `{ rows }`) — callers
// that use `db.execute()` normalise that themselves. Pinning one type here
// keeps method-overload resolution (e.g. `.returning({...})`) working, which a
// union of the two database types quietly breaks.
type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | null = null;

/**
 * Lazily builds the Drizzle client — never runs at module load, so an
 * unconfigured `DATABASE_URL` never crashes a build or a keyless boot. Each
 * app wraps this with its own "is the database configured?" check.
 *
 * Picks the driver from the URL: a local/Docker Postgres (`localhost`,
 * `127.0.0.1`, `::1`) uses the plain `postgres` (postgres.js) TCP driver,
 * since that's the only one that can reach it. Anything else (Neon, in
 * practice) uses Neon's HTTP-based serverless driver, which runs on
 * Cloudflare Workers as well as Node — Workers has no raw TCP sockets, so
 * both apps depend on this branch for their deployed builds.
 */
export function getDb(databaseUrl = process.env.DATABASE_URL): Db {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!cached) {
    cached = isLocalDatabaseUrl(databaseUrl)
      ? drizzlePostgresJs(postgres(databaseUrl, { max: 5, ssl: resolveSslMode(databaseUrl) }), {
          schema,
        })
      : (drizzleNeonHttp(neon(databaseUrl), { schema }) as unknown as Db);
  }
  return cached;
}
