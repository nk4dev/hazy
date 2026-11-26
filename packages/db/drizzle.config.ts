import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import { loadMonorepoEnv } from "../../scripts/load-env";

const pkgRoot = dirname(fileURLToPath(import.meta.url));
loadMonorepoEnv(pkgRoot);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set — add it to root .env.local / .env or packages/db/.env.local (or pass it inline)",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL },
  // NOT strict — plain `push` still confirms genuinely destructive changes
  // (drops, renames) on its own; strict prompts on every additive change too,
  // which hangs in any non-TTY context.
  verbose: true,
});
