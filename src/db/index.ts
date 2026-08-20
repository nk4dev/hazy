import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import { env, isDatabaseConfigured } from "@/lib/env";
import { isLocalDatabaseUrl, resolveSslMode } from "./connection-options";
import * as schema from "./schema";

type Db =
  | ReturnType<typeof drizzlePostgresJs<typeof schema>>
  | ReturnType<typeof drizzleNeonHttp<typeof schema>>;

let cached: Db | null = null;

/** Lazily builds the Drizzle client — never runs at module load, so an
 * unconfigured DATABASE_URL never crashes the build or a keyless boot.
 *
 * Picks the driver based on `DATABASE_URL`: a local/Docker Postgres
 * (`localhost`, `127.0.0.1`, `::1`) uses the plain `postgres` (postgres.js)
 * TCP driver, since that's the only one that can reach it — Neon's driver
 * only speaks its own HTTP SQL proxy protocol. Anything else (Neon, in
 * practice) uses Neon's HTTP-based serverless driver, which runs on
 * Cloudflare Workers as well as Node — Workers doesn't support the raw TCP
 * sockets postgres.js needs. */
export function getDb(): Db {
  const databaseUrl = env.DATABASE_URL;
  if (!isDatabaseConfigured() || !databaseUrl) {
    throw new ServiceNotConfiguredError("database");
  }
  if (!cached) {
    cached = isLocalDatabaseUrl(databaseUrl)
      ? drizzlePostgresJs(postgres(databaseUrl, { max: 5, ssl: resolveSslMode(databaseUrl) }), {
          schema,
        })
      : drizzleNeonHttp(neon(databaseUrl), { schema });
  }
  return cached;
}
