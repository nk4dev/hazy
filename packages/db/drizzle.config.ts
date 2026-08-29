import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as a bare script (no Next.js), so load the package's own
// .env.local for DATABASE_URL. `process.loadEnvFile` landed in Node 20.12+.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set — add it to packages/db/.env.local (or pass it inline)",
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
