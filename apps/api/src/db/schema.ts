// The Drizzle schema lives in the shared `@repo/db` package (one definition
// for both hazy and hazy-note). Re-exported here so the many `@/db/schema`
// imports across the app keep working.
export * from "@repo/db/schema";
