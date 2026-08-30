import { getDb } from "@repo/db/client";
import * as schema from "@repo/db/schema";

// The Drizzle schema + client live in the shared `@repo/db` package. `getDb`
// is lazy and self-caching, and picks postgres.js (local TCP) vs Neon's HTTP
// driver from the URL — the HTTP branch is what lets this app run on
// Cloudflare Workers, which has no raw TCP sockets.
export const db = getDb();

export { schema };
