import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env, isDatabaseConfigured } from "@/lib/env";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

/** Lazily builds the Drizzle client — never runs at module load, so an
 * unconfigured DATABASE_URL never crashes the build or a keyless boot.
 *
 * Uses Neon's HTTP-based serverless driver (fetch under the hood, no TCP
 * socket) so this runs on Cloudflare Workers as well as Node — Workers
 * doesn't support raw TCP the way the old `postgres` (postgres.js) driver
 * needed. This only works against a Neon database (or something speaking
 * Neon's HTTP SQL proxy protocol); a bare local/Docker Postgres won't work
 * here — point `DATABASE_URL` at a Neon branch for local dev too. */
export function getDb(): Db {
  if (!isDatabaseConfigured()) {
    throw new ServiceNotConfiguredError("database");
  }
  if (!cached) {
    const sqlClient = neon(env.DATABASE_URL!);
    cached = drizzle(sqlClient, { schema });
  }
  return cached;
}
