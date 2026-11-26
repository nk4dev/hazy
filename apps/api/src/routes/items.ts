import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { collectionItems, collections, readLaterState, savedUrls } from "@/db/schema";
import { summarizeItem } from "@/lib/ai/summarize-item";
import { ApiError, NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { fetchUrlMetadata } from "@/lib/metadata/fetch-metadata";
import { parseAndNormalizeUrl } from "@/lib/metadata/normalize-url";
import { toFxTwitterUrl } from "@/lib/metadata/x-fallback";
import { SAVED_URL_SUMMARY_COLUMNS, serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const items = new Hono<AppEnv>();

async function loadOwnedItem(userId: string, id: string) {
  const db = getDb();
  const row = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.id, id), eq(savedUrls.userId, userId)),
    columns: SAVED_URL_SUMMARY_COLUMNS,
    with: { readLaterState: true, collectionItems: true },
  });
  if (!row) throw new NotFoundError("Saved URL");
  return row;
}

async function assertOwnedCollections(
  db: ReturnType<typeof getDb>,
  userId: string,
  collectionIds: string[]
): Promise<string[]> {
  const uniqueIds = [...new Set(collectionIds)];
  if (uniqueIds.length === 0) return [];
  const owned = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.userId, userId), inArray(collections.id, uniqueIds)));
  if (owned.length !== uniqueIds.length) {
    throw new NotFoundError("Collection");
  }
  return uniqueIds;
}

/** Lowercase, trim, drop blanks/overlong entries, de-dupe, cap the list. */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag && tag.length <= 50) seen.add(tag);
  }
  return [...seen].slice(0, 30);
}

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

items.get("/", async (c) => {
  const user = c.get("user");
  const { cursor, limit, sort } = listQuerySchema.parse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    sort: c.req.query("sort"),
  });
  const db = getDb();

  let cursorCreatedAt: Date | undefined;
  if (cursor) {
    const cursorRow = await db.query.savedUrls.findFirst({
      where: and(eq(savedUrls.id, cursor), eq(savedUrls.userId, user.id)),
      columns: { createdAt: true },
    });
    cursorCreatedAt = cursorRow?.createdAt;
  }

  const conditions = [eq(savedUrls.userId, user.id)];
  if (cursorCreatedAt) {
    conditions.push(
      sort === "newest"
        ? lt(savedUrls.createdAt, cursorCreatedAt)
        : gt(savedUrls.createdAt, cursorCreatedAt)
    );
  }

  const rows = await db.query.savedUrls.findMany({
    where: and(...conditions),
    columns: SAVED_URL_SUMMARY_COLUMNS,
    orderBy: sort === "newest" ? [desc(savedUrls.createdAt)] : [asc(savedUrls.createdAt)],
    limit: limit + 1,
    with: { readLaterState: true, collectionItems: true },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return ok({
    items: page.map((row) =>
      serializeSavedUrl(
        row,
        row.readLaterState,
        row.collectionItems.map((ci) => ci.collectionId)
      )
    ),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

const createSchema = z.object({
  url: z.string().min(1),
  collectionIds: z.array(z.string().uuid()).max(100).optional(),
});

items.post("/", async (c) => {
  const user = c.get("user");
  const { url, collectionIds } = createSchema.parse(await c.req.json());
  const { url: cleanUrl, normalizedUrl, domain } = parseAndNormalizeUrl(url);
  const db = getDb();

  const requestedCollectionIds = collectionIds
    ? await assertOwnedCollections(db, user.id, collectionIds)
    : [];

  const existing = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.userId, user.id), eq(savedUrls.normalizedUrl, normalizedUrl)),
    columns: SAVED_URL_SUMMARY_COLUMNS,
    with: { readLaterState: true, collectionItems: true },
  });
  if (existing) {
    if (requestedCollectionIds.length > 0) {
      await db
        .insert(collectionItems)
        .values(
          requestedCollectionIds.map((collectionId) => ({
            collectionId,
            savedUrlId: existing.id,
          }))
        )
        .onConflictDoNothing({
          target: [collectionItems.collectionId, collectionItems.savedUrlId],
        });
    }
    const mergedIds = [
      ...new Set([
        ...existing.collectionItems.map((ci) => ci.collectionId),
        ...requestedCollectionIds,
      ]),
    ];
    return ok(serializeSavedUrl(existing, existing.readLaterState, mergedIds), { status: 200 });
  }

  const result = await fetchUrlMetadata(cleanUrl);

  const [row] = await db
    .insert(savedUrls)
    .values(
      result.status === "success"
        ? {
            userId: user.id,
            url: cleanUrl,
            normalizedUrl,
            domain,
            title: result.metadata.title,
            description: result.metadata.description,
            faviconUrl: result.metadata.faviconUrl,
            ogImageUrl: result.metadata.ogImageUrl,
            extractedText: result.metadata.extractedText,
            contentLanguage: result.metadata.contentLanguage,
            estimatedReadMinutes: result.metadata.estimatedReadMinutes,
            fetchStatus: "success" as const,
          }
        : {
            userId: user.id,
            url: cleanUrl,
            normalizedUrl,
            domain,
            fetchStatus: "error" as const,
            fetchError: result.error,
          }
    )
    .returning();

  const [rl] = await db
    .insert(readLaterState)
    .values({ userId: user.id, savedUrlId: row.id })
    .returning();

  if (requestedCollectionIds.length > 0) {
    await db
      .insert(collectionItems)
      .values(
        requestedCollectionIds.map((collectionId) => ({
          collectionId,
          savedUrlId: row.id,
        }))
      )
      .onConflictDoNothing({
        target: [collectionItems.collectionId, collectionItems.savedUrlId],
      });
  }

  return ok(serializeSavedUrl(row, rl, requestedCollectionIds), { status: 201 });
});

items.get("/:id", async (c) => {
  const user = c.get("user");
  const row = await loadOwnedItem(user.id, c.req.param("id"));
  return ok(
    serializeSavedUrl(
      row,
      row.readLaterState,
      row.collectionItems.map((ci) => ci.collectionId)
    )
  );
});

const patchSchema = z.object({
  summary: z.string().max(4000).nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
  tags: z.array(z.string()).max(100).optional(),
});

items.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await loadOwnedItem(user.id, id);
  const { tags, ...body } = patchSchema.parse(await c.req.json());
  const db = getDb();
  const [updated] = await db
    .update(savedUrls)
    .set({
      ...body,
      ...(tags ? { tags: normalizeTags(tags) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)))
    .returning();
  return ok(
    serializeSavedUrl(
      updated,
      existing.readLaterState,
      existing.collectionItems.map((ci) => ci.collectionId)
    )
  );
});

items.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedItem(user.id, id);
  const db = getDb();
  await db.delete(savedUrls).where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)));
  return ok({ id });
});

items.post("/:id/refetch", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await loadOwnedItem(user.id, id);
  const db = getDb();

  const result = await fetchUrlMetadata(existing.url);

  const [updated] = await db
    .update(savedUrls)
    .set(
      result.status === "success"
        ? {
            title: result.metadata.title,
            description: result.metadata.description,
            faviconUrl: result.metadata.faviconUrl,
            ogImageUrl: result.metadata.ogImageUrl,
            extractedText: result.metadata.extractedText,
            contentLanguage: result.metadata.contentLanguage,
            estimatedReadMinutes: result.metadata.estimatedReadMinutes,
            fetchStatus: "success" as const,
            fetchError: null,
            updatedAt: new Date(),
          }
        : {
            fetchStatus: "error" as const,
            fetchError: result.error,
            updatedAt: new Date(),
          }
    )
    .where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)))
    .returning();

  return ok(
    serializeSavedUrl(
      updated,
      existing.readLaterState,
      existing.collectionItems.map((ci) => ci.collectionId)
    )
  );
});

const setCollectionsSchema = z.object({
  collectionIds: z.array(z.string().uuid()).max(100),
});

items.put("/:id/collections", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await loadOwnedItem(user.id, id);
  const { collectionIds } = setCollectionsSchema.parse(await c.req.json());
  const db = getDb();

  const nextIds = await assertOwnedCollections(db, user.id, collectionIds);
  const nextSet = new Set(nextIds);
  const currentIds = new Set(existing.collectionItems.map((ci) => ci.collectionId));

  const toRemove = [...currentIds].filter((cid) => !nextSet.has(cid));
  const toAdd = nextIds.filter((cid) => !currentIds.has(cid));

  if (toRemove.length > 0) {
    await db
      .delete(collectionItems)
      .where(and(eq(collectionItems.savedUrlId, id), inArray(collectionItems.collectionId, toRemove)));
  }
  if (toAdd.length > 0) {
    await db
      .insert(collectionItems)
      .values(toAdd.map((collectionId) => ({ collectionId, savedUrlId: id })))
      .onConflictDoNothing({
        target: [collectionItems.collectionId, collectionItems.savedUrlId],
      });
  }

  return ok({ savedUrlId: id, collectionIds: nextIds });
});

items.post("/:id/summarize", async (c) => {
  const user = c.get("user");
  const result = await summarizeItem(user.id, c.req.param("id"));
  return ok(result);
});

const IMAGE_FETCH_TIMEOUT_MS = 8000;

/**
 * Streams the item's preview image straight through (never persisted here —
 * `og_image_url` only gets written by `refetch`). For x.com/twitter.com items
 * where og:image is blocked at the source, falls back to fxtwitter.com to
 * resolve an image URL on the fly.
 */
items.get("/:id/image", async (c) => {
  const user = c.get("user");
  const row = await loadOwnedItem(user.id, c.req.param("id"));

  let imageUrl = row.ogImageUrl;
  if (!imageUrl) {
    const fxUrl = toFxTwitterUrl(row.url);
    if (fxUrl) {
      const result = await fetchUrlMetadata(fxUrl);
      if (result.status === "success" && result.metadata.ogImageUrl) {
        imageUrl = result.metadata.ogImageUrl;
      }
    }
  }
  if (!imageUrl) throw new NotFoundError("Image");

  let imageResponse: Response;
  try {
    imageResponse = await fetch(imageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "HazyBot/1.0 (+https://hazy.app; link preview fetcher)" },
    });
  } catch {
    throw new ApiError(502, "image_fetch_failed", "Could not fetch the image.");
  }
  if (!imageResponse.ok || !imageResponse.body) {
    throw new ApiError(502, "image_fetch_failed", "Could not fetch the image.");
  }

  const contentType = imageResponse.headers.get("content-type") ?? "application/octet-stream";
  const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
  const filename = `${row.domain ?? "image"}-${row.id.slice(0, 8)}.${ext}`;

  return new Response(imageResponse.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
