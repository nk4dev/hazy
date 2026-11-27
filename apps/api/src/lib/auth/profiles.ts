import { and, asc, eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { profiles } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import type { AppProfile } from "@/types/hono";

export const RESERVED_PROFILE_SLUGS = new Set([
  "settings",
  "sign-in",
  "sign-up",
  "connector",
  "docs",
  "api",
  "p",
  "new",
  "default",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates and normalizes a profile slug. Throws `ValidationError` if invalid or reserved. */
export function validateProfileSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new ValidationError(
      "Profile slug must be 2-32 lowercase alphanumeric characters or hyphens."
    );
  }
  if (RESERVED_PROFILE_SLUGS.has(slug)) {
    throw new ValidationError(`Profile slug "${slug}" is reserved.`);
  }
  return slug;
}

export function serializeProfile(p: AppProfile) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    icon: p.icon,
    color: p.color,
    isDefault: p.isDefault,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/**
 * Ensures the user has at least one default profile (creating `personal` if none exists)
 * and returns it. Idempotent under concurrent requests.
 */
export async function ensureDefaultProfile(db: Database, userId: string): Promise<AppProfile> {
  const existingDefault = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, userId), eq(profiles.isDefault, true)),
  });
  if (existingDefault) return existingDefault;

  const firstProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    orderBy: [asc(profiles.sortOrder), asc(profiles.createdAt)],
  });
  if (firstProfile) {
    const [promoted] = await db
      .update(profiles)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(profiles.id, firstProfile.id), eq(profiles.userId, userId)))
      .returning();
    if (promoted) return promoted;
  }

  await db
    .insert(profiles)
    .values({
      userId,
      slug: "personal",
      name: "Personal",
      isDefault: true,
      sortOrder: 0,
    })
    .onConflictDoNothing({ target: [profiles.userId, profiles.slug] });

  const created = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    orderBy: [asc(profiles.sortOrder), asc(profiles.createdAt)],
  });
  if (!created) {
    throw new Error(`Failed to ensure default profile for user ${userId}`);
  }
  return created;
}

/**
 * Resolves a profile by UUID or slug for `userId`. When `selector` is omitted/blank,
 * returns the user's default profile.
 */
export async function resolveUserProfile(
  db: Database,
  userId: string,
  selector?: string | null
): Promise<AppProfile> {
  const trimmed = selector?.trim();
  if (!trimmed) {
    return ensureDefaultProfile(db, userId);
  }

  const profile = UUID_RE.test(trimmed)
    ? await db.query.profiles.findFirst({
        where: and(eq(profiles.userId, userId), eq(profiles.id, trimmed)),
      })
    : await db.query.profiles.findFirst({
        where: and(eq(profiles.userId, userId), eq(profiles.slug, trimmed.toLowerCase())),
      });

  if (!profile) {
    throw new NotFoundError("Profile");
  }
  return profile;
}
