import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { getDb } from "@/db";
import { blogConnections, blogPublications } from "@/db/schema";
import { env } from "@/env";
import { ApiError, NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { randomSecret, sha256Hex } from "@/lib/auth/api-token";
import { decryptCredentials, encryptCredentials } from "@/lib/blog/crypto";
import { getBlogProvider } from "@/lib/blog/providers";
import { buildCitationsMarkdown } from "@/lib/blog/references";
import { syncBlogConnection, upsertPublishedPostToSavedUrls } from "@/lib/blog/sync";
import type { AppEnv } from "@/types/hono";

const requireUserSession = createMiddleware<AppEnv>(async (c, next) => {
  const authVia = c.get("authVia");
  if (authVia !== "better_auth" && authVia !== "clerk") {
    throw new ApiError(403, "forbidden", "Not available to connected apps.");
  }
  await next();
});

export const blogs = new Hono<AppEnv>();

function serializeConnection(row: typeof blogConnections.$inferSelect) {
  const supportsWebhook = row.provider === "microcms" || row.provider === "zenn";
  return {
    id: row.id,
    profileId: row.profileId,
    provider: row.provider,
    label: row.label,
    config: row.config,
    isEnabled: row.isEnabled,
    webhookUrl: supportsWebhook ? `${env.BETTER_AUTH_URL}/v1/webhooks/blog/${row.webhookToken}` : null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePublication(row: typeof blogPublications.$inferSelect) {
  return {
    id: row.id,
    profileId: row.profileId,
    connectionId: row.connectionId,
    noteId: row.noteId,
    savedUrlId: row.savedUrlId,
    externalId: row.externalId,
    externalSlug: row.externalSlug,
    externalUrl: row.externalUrl,
    title: row.title,
    status: row.status,
    tags: row.tags,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

blogs.get("/connections", async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const rows = await getDb().query.blogConnections.findMany({
    where: and(eq(blogConnections.userId, user.id), eq(blogConnections.profileId, profile.id)),
    orderBy: [desc(blogConnections.createdAt)],
  });
  return ok({ items: rows.map(serializeConnection) });
});

const createConnectionSchema = z.object({
  provider: z.enum(["microcms", "qiita", "zenn"]),
  label: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.unknown()).default({}),
  credentials: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean().default(true),
});

blogs.post("/connections", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const body = createConnectionSchema.parse(await c.req.json());

  const encryptedCredentials = await encryptCredentials(body.credentials);
  const webhookToken = randomSecret("bw_").slice(0, 48);

  const [created] = await getDb()
    .insert(blogConnections)
    .values({
      userId: user.id,
      profileId: profile.id,
      provider: body.provider,
      label: body.label,
      config: body.config,
      encryptedCredentials,
      webhookToken,
      isEnabled: body.isEnabled,
    })
    .returning();

  if (!created) throw new Error("Failed to create blog connection");
  return ok(serializeConnection(created), { status: 201 });
});

const updateConnectionSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

blogs.patch("/connections/:id", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const id = c.req.param("id");
  const body = updateConnectionSchema.parse(await c.req.json());
  const db = getDb();

  const existing = await db.query.blogConnections.findFirst({
    where: and(
      eq(blogConnections.id, id),
      eq(blogConnections.userId, user.id),
      eq(blogConnections.profileId, profile.id)
    ),
  });
  if (!existing) throw new NotFoundError("Blog connection");

  const encryptedCredentials = body.credentials
    ? await encryptCredentials(body.credentials)
    : existing.encryptedCredentials;

  const [updated] = await db
    .update(blogConnections)
    .set({
      label: body.label ?? existing.label,
      config: body.config ?? existing.config,
      encryptedCredentials,
      isEnabled: body.isEnabled ?? existing.isEnabled,
      updatedAt: new Date(),
    })
    .where(and(eq(blogConnections.id, id), eq(blogConnections.userId, user.id)))
    .returning();

  if (!updated) throw new NotFoundError("Blog connection");
  return ok(serializeConnection(updated));
});

blogs.delete("/connections/:id", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const id = c.req.param("id");
  const [deleted] = await getDb()
    .delete(blogConnections)
    .where(
      and(
        eq(blogConnections.id, id),
        eq(blogConnections.userId, user.id),
        eq(blogConnections.profileId, profile.id)
      )
    )
    .returning({ id: blogConnections.id });
  if (!deleted) throw new NotFoundError("Blog connection");
  return ok({ id: deleted.id });
});

blogs.post("/connections/:id/test", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const id = c.req.param("id");
  const conn = await getDb().query.blogConnections.findFirst({
    where: and(
      eq(blogConnections.id, id),
      eq(blogConnections.userId, user.id),
      eq(blogConnections.profileId, profile.id)
    ),
  });
  if (!conn) throw new NotFoundError("Blog connection");

  const creds = await decryptCredentials<Record<string, unknown>>(conn.encryptedCredentials);
  const result = await getBlogProvider(conn.provider).testConnection(conn.config, creds);
  return ok(result);
});

blogs.post("/connections/:id/sync", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const id = c.req.param("id");
  const db = getDb();
  const conn = await db.query.blogConnections.findFirst({
    where: and(
      eq(blogConnections.id, id),
      eq(blogConnections.userId, user.id),
      eq(blogConnections.profileId, profile.id)
    ),
  });
  if (!conn) throw new NotFoundError("Blog connection");

  const result = await syncBlogConnection(db, conn);
  return ok(result);
});

blogs.get("/publications", async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const noteId = c.req.query("noteId");
  const rows = await getDb().query.blogPublications.findMany({
    where: and(
      eq(blogPublications.userId, user.id),
      eq(blogPublications.profileId, profile.id),
      ...(noteId ? [eq(blogPublications.noteId, noteId)] : [])
    ),
    orderBy: [desc(blogPublications.updatedAt)],
  });
  return ok({ items: rows.map(serializePublication) });
});

const publishSchema = z.object({
  connectionId: z.string().uuid(),
  noteId: z.string().uuid().optional(),
  publicationId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  slug: z.string().trim().max(100).optional(),
  emoji: z.string().trim().max(8).optional(),
  zennType: z.enum(["tech", "idea"]).optional(),
  citedSavedUrlIds: z.array(z.string().uuid()).max(50).optional(),
  citedCollectionIds: z.array(z.string().uuid()).max(10).optional(),
  citationStyle: z.enum(["list", "footnote", "cards"]).optional(),
});

blogs.post("/publish", requireUserSession, async (c) => {
  const user = c.get("user");
  const profile = c.get("profile");
  const body = publishSchema.parse(await c.req.json());
  const db = getDb();

  const conn = await db.query.blogConnections.findFirst({
    where: and(
      eq(blogConnections.id, body.connectionId),
      eq(blogConnections.userId, user.id),
      eq(blogConnections.profileId, profile.id)
    ),
  });
  if (!conn) throw new NotFoundError("Blog connection");

  let existingExternalId: string | undefined;
  if (body.publicationId) {
    const existingPub = await db.query.blogPublications.findFirst({
      where: and(
        eq(blogPublications.id, body.publicationId),
        eq(blogPublications.connectionId, conn.id),
        eq(blogPublications.userId, user.id)
      ),
    });
    if (existingPub) existingExternalId = existingPub.externalId;
  }

  const citationsMd = await buildCitationsMarkdown(db, {
    userId: user.id,
    profileId: profile.id,
    savedUrlIds: body.citedSavedUrlIds,
    collectionIds: body.citedCollectionIds,
    style: body.citationStyle,
    provider: conn.provider,
  });

  const fullMarkdown = citationsMd ? `${body.markdown.trimEnd()}\n\n${citationsMd}` : body.markdown;
  const creds = await decryptCredentials<Record<string, unknown>>(conn.encryptedCredentials);
  const adapter = getBlogProvider(conn.provider);

  const published = await adapter.publish(
    {
      externalId: existingExternalId,
      title: body.title,
      markdown: fullMarkdown,
      status: body.status,
      tags: body.tags,
      slug: body.slug,
      emoji: body.emoji,
      zennType: body.zennType,
    },
    conn.config,
    creds
  );

  const contentHash = await sha256Hex(`${body.title}\n${fullMarkdown}\n${body.tags.join(",")}`);
  const savedUrlId =
    published.status === "published"
      ? await upsertPublishedPostToSavedUrls(
          db,
          conn,
          {
            externalId: published.externalId,
            externalSlug: published.externalSlug,
            externalUrl: published.externalUrl,
            title: body.title,
            bodyMarkdown: fullMarkdown,
            status: "published",
            tags: body.tags,
            publishedAt: published.publishedAt,
          },
          body.noteId ?? null
        )
      : null;

  const now = new Date();
  const [pubRow] = await db
    .insert(blogPublications)
    .values({
      userId: user.id,
      profileId: profile.id,
      connectionId: conn.id,
      noteId: body.noteId ?? null,
      savedUrlId,
      externalId: published.externalId,
      externalSlug: published.externalSlug,
      externalUrl: published.externalUrl,
      title: body.title,
      status: published.status,
      tags: body.tags,
      contentHash,
      publishedAt: published.publishedAt,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [blogPublications.connectionId, blogPublications.externalId],
      set: {
        noteId: body.noteId ?? null,
        savedUrlId,
        externalSlug: published.externalSlug,
        externalUrl: published.externalUrl,
        title: body.title,
        status: published.status,
        tags: body.tags,
        contentHash,
        publishedAt: published.publishedAt,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (!pubRow) throw new Error("Failed to save blog publication");
  return ok(serializePublication(pubRow), { status: 201 });
});
