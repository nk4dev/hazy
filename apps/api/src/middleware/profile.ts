import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { UnauthorizedError } from "@/lib/api/errors";
import { resolveUserProfile } from "@/lib/auth/profiles";
import type { AppEnv } from "@/types/hono";

/**
 * Resolves `c.get("profile")` for every `/v1/*` request after `authMiddleware`:
 *   - `api_token`: locked to `api_tokens.profile_id` (`X-Hazy-Profile` is ignored).
 *   - `better_auth` / `clerk`: uses `X-Hazy-Profile` (slug or UUID) or falls back to default.
 */
export const profileMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  const authVia = c.get("authVia");
  const db = getDb();

  if (authVia === "api_token") {
    const tokenProfileId = c.get("apiTokenProfileId");
    if (!tokenProfileId) throw new UnauthorizedError();
    const profile = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, tokenProfileId), eq(profiles.userId, user.id)),
    });
    if (!profile) throw new UnauthorizedError();
    c.set("profile", profile);
    return next();
  }

  const headerSelector = c.req.header("X-Hazy-Profile");
  const profile = await resolveUserProfile(db, user.id, headerSelector);
  c.set("profile", profile);
  return next();
});
