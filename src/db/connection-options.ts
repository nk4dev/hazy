/**
 * SSL mode for the `postgres` client. Respects an explicit `sslmode` query
 * param if the connection string already has one (Neon, Supabase, RDS, etc.
 * all include one in the string they give you) — otherwise defaults to
 * "require" for any remote host and "disable" for localhost, so a local
 * Docker/Postgres.app database works with zero config.
 */
type PostgresSslOption = boolean | "require" | "allow" | "prefer" | "verify-full";

export function resolveSslMode(databaseUrl: string): PostgresSslOption | undefined {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return undefined;
  }

  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode === "disable") return false;
  if (
    sslmode === "require" ||
    sslmode === "allow" ||
    sslmode === "prefer" ||
    sslmode === "verify-full"
  ) {
    return sslmode;
  }
  if (sslmode) return undefined; // an explicit mode we don't need to override

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  return isLocal ? false : "require";
}
