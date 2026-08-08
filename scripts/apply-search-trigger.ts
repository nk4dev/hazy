import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { resolveSslMode } from "../src/db/connection-options";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }

  const sqlPath = join(process.cwd(), "src/db/sql/search-vector-trigger.sql");
  const sqlText = readFileSync(sqlPath, "utf-8");
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
