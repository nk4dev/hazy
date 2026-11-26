import { createClerkClient } from "@clerk/backend";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { UnauthorizedError } from "@/lib/api/errors";
import { isAllowedAdminEmail } from "@/lib/auth/better-auth";
import { env, isClerkConfigured, isDatabaseConfigured } from "@/env";

export type AppUser = typeof users.$inferSelect;

let cachedClerk: ReturnType<typeof createClerkClient> | null = null;

function clerk() {
  if (!cachedClerk) {
    cachedClerk = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
  }
  return cachedClerk;
}

/**
 * Verifies the request's `Authorization: Bearer <session-jwt>` and returns the
 * Clerk user id, or null when there's no valid session. Replaces
 * `@clerk/nextjs/server`'s `auth()` for the standalone Worker.
 *
 * No `authorizedParties` here: that option checks the token's `azp` claim
 * against a list of web origins, which is a CSRF guard for cookie-based
 * browser sessions. Bearer-token callers (the Flutter app, any other native
 * client) don't send an Origin and never populate `azp`, so enforcing it
 * rejected every legitimate mobile session with a 401 — this endpoint is
 * only reachable with a valid signed Clerk JWT regardless.
 */
export async function authenticate(request: Request): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  const state = await clerk().authenticateRequest(request);
  if (!state.isAuthenticated) return null;
  return state.toAuth().userId ?? null;
}

/**
 * Resolves a Clerk user id to our internal `users` row, creating it (and a
 * default `userPreferences` row) on first sight. Port of hazy's
 * `getOptionalUser` — the webhook keeps profile fields fresh afterward, but we
 * don't want to depend on it having fired first.
 */
export async function resolveUser(clerkId: string): Promise<AppUser> {
  if (!isDatabaseConfigured()) throw new UnauthorizedError();

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;

  const clerkUser = await clerk()
    .users.getUser(clerkId)
    .catch(() => null);
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;

  const [created] = await db
    .insert(users)
    .values({ clerkId, email, displayName, avatarUrl: clerkUser?.imageUrl ?? null })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();

  const user =
    created ?? (await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) }));
  if (!user) {
    throw new UnauthorizedError("Could not resolve account. Try again.");
  }

  await db
    .insert(userPreferences)
    .values({ userId: user.id })
    .onConflictDoNothing({ target: userPreferences.userId });

  return user;
}

/**
 * Resolves a Better Auth user to our internal `users` row (`users.id` UUID is
 * preserved). Links an unlinked pre-existing row by case-insensitive email
 * first so migrated Clerk data stays intact under the same `users.id`.
 */
export async function resolveBetterAuthUser(authUserRecord: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<AppUser> {
  if (!isDatabaseConfigured()) throw new UnauthorizedError();
  if (!isAllowedAdminEmail(authUserRecord.email)) {
    throw new UnauthorizedError("Account is not authorized.");
  }

  const normalizedEmail = authUserRecord.email.trim().toLowerCase();
  const db = getDb();

  const existingByAuth = await db.query.users.findFirst({
    where: eq(users.authUserId, authUserRecord.id),
  });
  if (existingByAuth) return existingByAuth;

  const existingByEmail = await db.query.users.findFirst({
    where: and(isNull(users.authUserId), sql`lower(${users.email}) = ${normalizedEmail}`),
  });
  if (existingByEmail) {
    const [linked] = await db
      .update(users)
      .set({
        authUserId: authUserRecord.id,
        displayName: existingByEmail.displayName ?? authUserRecord.name ?? null,
        avatarUrl: existingByEmail.avatarUrl ?? authUserRecord.image ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id))
      .returning();
    if (linked) return linked;
  }

  const [created] = await db
    .insert(users)
    .values({
      authUserId: authUserRecord.id,
      email: normalizedEmail,
      displayName: authUserRecord.name ?? null,
      avatarUrl: authUserRecord.image ?? null,
    })
    .onConflictDoNothing({ target: users.authUserId })
    .returning();

  const user =
    created ??
    (await db.query.users.findFirst({ where: eq(users.authUserId, authUserRecord.id) }));
  if (!user) {
    throw new UnauthorizedError("Could not resolve account. Try again.");
  }

  await db
    .insert(userPreferences)
    .values({ userId: user.id })
    .onConflictDoNothing({ target: userPreferences.userId });

  return user;
}
