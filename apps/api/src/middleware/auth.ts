import { createMiddleware } from "hono/factory";
import { isBetterAuthConfigured, isClerkConfigured } from "@/env";
import { UnauthorizedError } from "@/lib/api/errors";
import { API_TOKEN_PREFIX, resolveApiToken } from "@/lib/auth/api-token";
import { getBetterAuthSession } from "@/lib/auth/better-auth";
import { authenticate, resolveBetterAuthUser, resolveUser } from "@/lib/auth/current-user";
import type { AppEnv } from "@/types/hono";

/**
 * Dual-auth gate for `/v1/**` (except webhooks, `/v1/auth-config`, and `/v1/connect/token`):
 *   1. `Authorization: Bearer hz_...` → connected-app API token (`authVia: "api_token"`)
 *   2. Better Auth HttpOnly cookie session (`authVia: "better_auth"`)
 *   3. Temporary Clerk JWT fallback (`authVia: "clerk"`)
 * Missing/invalid credentials throw `UnauthorizedError` → 401 envelope.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "");

  if (bearer?.startsWith(API_TOKEN_PREFIX)) {
    const user = await resolveApiToken(bearer);
    if (!user) throw new UnauthorizedError();
    c.set("user", user);
    c.set("authVia", "api_token");
    return next();
  }

  if (isBetterAuthConfigured() && c.req.header("cookie")) {
    const session = await getBetterAuthSession(c.req.raw.headers);
    if (session?.user) {
      const user = await resolveBetterAuthUser(session.user);
      c.set("user", user);
      c.set("authVia", "better_auth");
      return next();
    }
  }

  if (isClerkConfigured() && authHeader) {
    const clerkId = await authenticate(c.req.raw);
    if (clerkId) {
      c.set("user", await resolveUser(clerkId));
      c.set("authVia", "clerk");
      return next();
    }
  }

  throw new UnauthorizedError();
});
