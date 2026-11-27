import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadMonorepoEnv } from "../../../scripts/load-env";
import { resolveSslMode } from "../src/connection-options";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

async function ensureBaselineIfNeeded(sql: postgres.Sql, migrationsFolder: string) {
  await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
  await sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const [{ count }] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM "drizzle"."__drizzle_migrations"
  `;
  if (Number(count) > 0) return;

  const [state] = await sql<
    {
      users_tbl: string | null;
      auth_user_tbl: string | null;
      api_tokens_tbl: string | null;
      graph_snapshots_tbl: string | null;
      insight_profiles_tbl: string | null;
      projects_tbl: string | null;
      notes_tbl: string | null;
    }[]
  >`
    SELECT
      to_regclass('public.users') AS users_tbl,
      to_regclass('public.auth_user') AS auth_user_tbl,
      to_regclass('public.api_tokens') AS api_tokens_tbl,
      to_regclass('public.graph_snapshots') AS graph_snapshots_tbl,
      to_regclass('public.insight_profiles') AS insight_profiles_tbl,
      to_regclass('public.projects') AS projects_tbl,
      to_regclass('public.notes') AS notes_tbl
  `;

  if (!state?.users_tbl || state.auth_user_tbl) return;

  const tag = state.api_tokens_tbl
    ? "0008_high_katie_power"
    : state.graph_snapshots_tbl
      ? "0007_supreme_roxanne_simpson"
      : state.insight_profiles_tbl
        ? "0006_modern_nekra"
        : state.projects_tbl
          ? "0005_useful_jack_flag"
          : state.notes_tbl
            ? "0001_app_domain"
            : "0000_baseline";

  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf-8")
  ) as { entries: JournalEntry[] };
  const entry = journal.entries.find((e) => e.tag === tag);
  if (!entry) return;

  const sqlBytes = readFileSync(join(migrationsFolder, `${tag}.sql`));
  const hash = createHash("sha256").update(sqlBytes).digest("hex");

  await sql`
    INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
    VALUES (${hash}, ${entry.when})
  `;
  console.log(`Baseline stamped at ${tag}; applying remaining migrations...`);
}

async function main() {
  loadMonorepoEnv(pkgRoot);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Add it via 1Password (`op run --env-file=...`) or root .env.local first."
    );
    process.exit(1);
  }

  const migrationsFolder = join(pkgRoot, "migrations");
  const sql = postgres(databaseUrl, { max: 1, ssl: resolveSslMode(databaseUrl) });
  const db = drizzle(sql);

  try {
    await ensureBaselineIfNeeded(sql, migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
