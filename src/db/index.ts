import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env, isDatabaseConfigured } from "@/lib/env";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import { resolveSslMode } from "./connection-options";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

/** Lazily builds the Drizzle client — never runs at module load, so an
 * unconfigured DATABASE_URL never crashes the build or a keyless boot.
 *
 * Uses the plain `postgres` (postgres.js) driver over a standard TCP
 * connection string, so this works against any Postgres server — Neon,
 * Supabase, RDS, a local Docker container, whatever — not just Neon's
 * HTTP-only serverless driver. In a serverless/edge deployment, keep `max`
 * low (or use Neon/Supabase's own connection pooler URL) since each
 * function instance opens its own TCP connections. */
export function getDb(): Db {
  if (!isDatabaseConfigured()) {
    throw new ServiceNotConfiguredError("database");
  }
  if (!cached) {
    const databaseUrl = env.DATABASE_URL!;
    const sqlClient = postgres(databaseUrl, {
      max: 5,
      ssl: resolveSslMode(databaseUrl),
    });
    cached = drizzle(sqlClient, { schema });
  }
  return cached;
}
