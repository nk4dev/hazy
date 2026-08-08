import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  // NOT strict: true — that forces an interactive confirmation prompt on
  // every `db:push`, even trivial additive ones, which hangs forever in any
  // non-TTY context (CI, scripts). Plain `push` still confirms genuinely
  // ambiguous/destructive changes (renames, drops) on its own.
});
