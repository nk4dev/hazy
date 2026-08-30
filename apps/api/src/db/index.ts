import { getDb as baseGetDb } from "@repo/db/client";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import { env, isDatabaseConfigured } from "@/env";

/**
 * hazy's DB accessor: the shared lazy dual-driver client from `@repo/db`,
 * gated by hazy's "boot with no keys" contract — an unconfigured
 * `DATABASE_URL` surfaces as a `ServiceNotConfiguredError` (→ the setup
 * screen), never a crash.
 */
export function getDb() {
  if (!isDatabaseConfigured() || !env.DATABASE_URL) {
    throw new ServiceNotConfiguredError("database");
  }
  return baseGetDb(env.DATABASE_URL);
}
