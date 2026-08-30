import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "@/lib/api/errors";
import { authenticate, resolveUser } from "@/lib/auth/current-user";
import type { AppEnv } from "@/types/hono";

/**
 * Gate for `/v1/**` (except the webhook): verify the Clerk bearer token, resolve
 * the internal user row, stash it on the context. A missing/invalid token throws
 * `UnauthorizedError` → `onError` → `401 { error: { code: "unauthorized" } }`.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const clerkId = await authenticate(c.req.raw);
  if (!clerkId) throw new UnauthorizedError();
  c.set("user", await resolveUser(clerkId));
  await next();
});
