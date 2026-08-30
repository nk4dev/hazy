import type { AppUser } from "@/lib/auth/current-user";

/** Hono generics for the authed part of the API — `c.get("user")` is the
 * resolved internal `users` row, set by `authMiddleware`. */
export type AppEnv = { Variables: { user: AppUser } };
