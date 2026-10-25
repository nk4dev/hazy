import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "@/lib/api/errors";
import { API_TOKEN_PREFIX, resolveApiToken } from "@/lib/auth/api-token";
import { authenticate, resolveUser } from "@/lib/auth/current-user";
import type { AppEnv } from "@/types/hono";

/**
 * Gate for `/v1/**` (except the webhook and `/v1/connect/token`): verify the
 * bearer, resolve the internal user row, stash it on the context. Two kinds of
 * bearer: a Clerk session JWT (hazy itself, the Flutter app) or an `hz_…`
 * connected-app token (`authVia: "api_token"`). A missing/invalid token throws
 * `UnauthorizedError` → `onError` → `401 { error: { code: "unauthorized" } }`.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const bearer = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer?.startsWith(API_TOKEN_PREFIX)) {
    const user = await resolveApiToken(bearer);
    if (!user) throw new UnauthorizedError();
    c.set("user", user);
    c.set("authVia", "api_token");
    return next();
  }

  const clerkId = await authenticate(c.req.raw);
  if (!clerkId) throw new UnauthorizedError();
  c.set("user", await resolveUser(clerkId));
  c.set("authVia", "clerk");
  await next();
});
