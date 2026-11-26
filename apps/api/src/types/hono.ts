import type { AppUser } from "@/lib/auth/current-user";

/** Hono generics for the authed part of the API — `c.get("user")` is the
 * resolved internal `users` row, set by `authMiddleware`; `authVia` says how
 * the request authenticated (a connected app's `hz_…` token can't manage
 * connections). */
export type AppEnv = {
  Variables: { user: AppUser; authVia: "better_auth" | "clerk" | "api_token" };
};
