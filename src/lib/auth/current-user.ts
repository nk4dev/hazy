import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { UnauthorizedError } from "@/lib/api/errors";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";

export type AppUser = typeof users.$inferSelect;

/**
 * Resolves the signed-in Clerk user to our internal `users` row, creating it
 * (and a default `userPreferences` row) on first sight. The Clerk webhook
 * (src/app/api/v1/webhooks/clerk/route.ts) keeps profile fields fresh after
 * that, but we don't want to depend on the webhook having already fired
 * (e.g. in local dev without a public URL) before a user can do anything.
 */
export async function getOptionalUser(): Promise<AppUser | null> {
  if (!isClerkConfigured() || !isDatabaseConfigured()) return null;

  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  if (existing) return existing;

  const clerkUser = await clerkCurrentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;

  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email,
      displayName,
      avatarUrl: clerkUser?.imageUrl ?? null,
    })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();

  const user = created ?? (await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) }));

  if (!user) {
    // Extremely unlikely race (conflict + re-read miss); surface as unauthorized
    // rather than crash the request.
    throw new UnauthorizedError("Could not resolve account. Try again.");
  }

  await db
    .insert(userPreferences)
    .values({ userId: user.id })
    .onConflictDoNothing({ target: userPreferences.userId });

  return user;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getOptionalUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
