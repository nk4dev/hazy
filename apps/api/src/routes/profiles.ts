import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { ApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import {
  ensureDefaultProfile,
  serializeProfile,
  validateProfileSlug,
} from "@/lib/auth/profiles";
import type { AppEnv } from "@/types/hono";

const requireUserSession = createMiddleware<AppEnv>(async (c, next) => {
  const authVia = c.get("authVia");
  if (authVia !== "better_auth" && authVia !== "clerk") {
    throw new ApiError(403, "forbidden", "Not available to connected apps.");
  }
  await next();
});

export const profileRoutes = new Hono<AppEnv>();
profileRoutes.use("*", requireUserSession);

profileRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb();
  await ensureDefaultProfile(db, user.id);

  const rows = await db.query.profiles.findMany({
    where: eq(profiles.userId, user.id),
    orderBy: [asc(profiles.sortOrder), asc(profiles.createdAt)],
  });

  return ok({
    items: rows.map(serializeProfile),
  });
});

const createSchema = z.object({
  slug: z.string().min(2).max(32),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(32).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
  isDefault: z.boolean().optional(),
});

profileRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = createSchema.parse(await c.req.json());
  const slug = validateProfileSlug(body.slug);
  const db = getDb();

  const existing = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, user.id), eq(profiles.slug, slug)),
  });
  if (existing) {
    throw new ApiError(409, "conflict", `Profile slug "${slug}" already exists.`);
  }

  if (body.isDefault) {
    await db
      .update(profiles)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(profiles.userId, user.id), eq(profiles.isDefault, true)));
  }

  const [created] = await db
    .insert(profiles)
    .values({
      userId: user.id,
      slug,
      name: body.name,
      icon: body.icon ?? null,
      color: body.color ?? null,
      isDefault: Boolean(body.isDefault),
      sortOrder: 0,
    })
    .returning();

  if (!created) throw new Error("Failed to create profile");
  return ok(serializeProfile(created), { status: 201 });
});

const updateSchema = z.object({
  slug: z.string().min(2).max(32).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  icon: z.string().trim().max(32).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  isDefault: z.boolean().optional(),
});

profileRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = updateSchema.parse(await c.req.json());
  const db = getDb();

  const target = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, id), eq(profiles.userId, user.id)),
  });
  if (!target) throw new NotFoundError("Profile");

  const nextSlug = body.slug !== undefined ? validateProfileSlug(body.slug) : target.slug;
  if (nextSlug !== target.slug) {
    const conflict = await db.query.profiles.findFirst({
      where: and(eq(profiles.userId, user.id), eq(profiles.slug, nextSlug)),
    });
    if (conflict) throw new ApiError(409, "conflict", `Profile slug "${nextSlug}" already exists.`);
  }

  if (body.isDefault === true && !target.isDefault) {
    await db
      .update(profiles)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(profiles.userId, user.id), eq(profiles.isDefault, true)));
  } else if (body.isDefault === false && target.isDefault) {
    throw new ValidationError("Cannot unset default profile directly; set another profile as default.");
  }

  const [updated] = await db
    .update(profiles)
    .set({
      slug: nextSlug,
      name: body.name ?? target.name,
      icon: body.icon !== undefined ? body.icon : target.icon,
      color: body.color !== undefined ? body.color : target.color,
      sortOrder: body.sortOrder ?? target.sortOrder,
      isDefault: body.isDefault ?? target.isDefault,
      updatedAt: new Date(),
    })
    .where(and(eq(profiles.id, id), eq(profiles.userId, user.id)))
    .returning();

  if (!updated) throw new NotFoundError("Profile");
  return ok(serializeProfile(updated));
});

profileRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getDb();

  const all = await db.query.profiles.findMany({
    where: eq(profiles.userId, user.id),
  });
  const target = all.find((p) => p.id === id);
  if (!target) throw new NotFoundError("Profile");
  if (all.length <= 1) {
    throw new ValidationError("Cannot delete your only profile.");
  }
  if (target.isDefault) {
    throw new ValidationError("Cannot delete the default profile. Set another profile as default first.");
  }

  await db.delete(profiles).where(and(eq(profiles.id, id), eq(profiles.userId, user.id)));
  return ok({ id });
});
