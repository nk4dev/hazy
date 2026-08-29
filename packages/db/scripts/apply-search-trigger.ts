import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { resolveSslMode } from "../src/connection-options";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  if (existsSync(join(pkgRoot, ".env.local"))) {
    process.loadEnvFile(join(pkgRoot, ".env.local"));
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to packages/db/.env.local first.");
    process.exit(1);
  }

  const sqlText = readFileSync(join(pkgRoot, "sql/search-vector-trigger.sql"), "utf-8");
  const sql = postgres(databaseUrl, { max: 1, ssl: resolveSslMode(databaseUrl) });

  try {
    // .unsafe() runs the raw multi-statement string as-is — needed here since
    // the file has several statements (function, trigger, backfill update).
    await sql.unsafe(sqlText);
    console.log("search_vector trigger applied.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
