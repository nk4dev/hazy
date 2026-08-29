import { auth, currentUser } from "@clerk/nextjs/server";
import { db, schema } from "./index";
import { seedForUser } from "./seed";

/**
 * Resolve the signed-in Clerk user to a row in our `users` table, creating
 * (and seeding) it on first sight. Every API route calls this first — the
 * app is single-tenant per Clerk account, so every query below is scoped by
 * the returned internal uuid.
 */
export async function requireAppUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    const err = new Error("unauthenticated");
    err.name = "Unauthenticated";
    throw err;
  }

  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.clerkId, clerkId),
  });
  if (existing) return existing;

  const cu = await currentUser();
  const [created] = await db
    .insert(schema.users)
    .values({
      clerkId,
      email: cu?.emailAddresses[0]?.emailAddress,
      displayName: cu?.fullName || cu?.username || undefined,
      avatarUrl: cu?.imageUrl,
    })
    // Two concurrent first-requests could both miss the findFirst above;
    // let the unique constraint pick one and fetch that row instead of 500ing.
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      set: { updatedAt: new Date() },
    })
    .returning();

  await seedForUser(created.id);
  return created;
}
