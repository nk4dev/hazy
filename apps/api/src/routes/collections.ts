import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { collectionItems, collections, savedUrls } from "@/db/schema";
import { summarizeCollection } from "@/lib/ai/summarize-collection";
import { NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { serializeCollection, serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const collections_ = new Hono<AppEnv>();

const PREVIEW_IMAGES_PER_COLLECTION = 4;

async function loadOwnedCollection(userId: string, id: string) {
  const db = getDb();
  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, id), eq(collections.userId, userId)),
  });
  if (!collection) throw new NotFoundError("Collection");
  return collection;
}

/** Up to N recent og:image URLs per collection, for the grid preview thumbnail. */
async function buildPreviewMap(
  db: ReturnType<typeof getDb>,
  collectionIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (collectionIds.length === 0) return map;

  const imageRows = await db
    .select({
      collectionId: collectionItems.collectionId,
      ogImageUrl: savedUrls.ogImageUrl,
    })
    .from(collectionItems)
    .innerJoin(savedUrls, eq(savedUrls.id, collectionItems.savedUrlId))
    .where(
      and(inArray(collectionItems.collectionId, collectionIds), isNotNull(savedUrls.ogImageUrl))
    )
    .orderBy(desc(collectionItems.createdAt));

  for (const { collectionId, ogImageUrl } of imageRows) {
    if (!ogImageUrl) continue;
    const existing = map.get(collectionId) ?? [];
    if (existing.length >= PREVIEW_IMAGES_PER_COLLECTION || existing.includes(ogImageUrl)) continue;
    existing.push(ogImageUrl);
    map.set(collectionId, existing);
  }

  return map;
}

collections_.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = await db
    .select({ collection: collections, itemCount: count(collectionItems.id) })
    .from(collections)
    .leftJoin(collectionItems, eq(collectionItems.collectionId, collections.id))
    .where(eq(collections.userId, user.id))
    .groupBy(collections.id)
    .orderBy(collections.createdAt);

  const previewsByCollection = await buildPreviewMap(
    db,
    rows.map(({ collection }) => collection.id)
  );

  return ok({
    items: rows.map(({ collection, itemCount }) =>
      serializeCollection(collection, itemCount, previewsByCollection.get(collection.id) ?? [])
    ),
  });
});

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  color: z.string().max(32).optional(),
});

collections_.post("/", async (c) => {
  const user = c.get("user");
  const body = createSchema.parse(await c.req.json());
  const db = getDb();

  const [row] = await db
    .insert(collections)
    .values({ userId: user.id, ...body })
    .returning();

  return ok(serializeCollection(row, 0), { status: 201 });
});

collections_.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const collection = await loadOwnedCollection(user.id, id);
  const db = getDb();

  const rows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, id),
    with: { savedUrl: { with: { readLaterState: true } } },
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });

  const itemDtos = rows
    .filter((r): r is typeof r & { savedUrl: NonNullable<typeof r.savedUrl> } => Boolean(r.savedUrl))
    .map((r) => serializeSavedUrl(r.savedUrl, r.savedUrl.readLaterState));

  return ok({
    ...serializeCollection(collection, itemDtos.length),
    items: itemDtos,
  });
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
});

collections_.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedCollection(user.id, id);
  const body = patchSchema.parse(await c.req.json());
  const db = getDb();
  const [updated] = await db
    .update(collections)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(collections.id, id), eq(collections.userId, user.id)))
    .returning();
  return ok(serializeCollection(updated, 0));
});

collections_.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedCollection(user.id, id);
  const db = getDb();
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, user.id)));
  return ok({ id });
});

const addItemSchema = z.object({ savedUrlId: z.string().uuid() });

collections_.post("/:id/items", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { savedUrlId } = addItemSchema.parse(await c.req.json());
  const db = getDb();

  const [collection, item] = await Promise.all([
    db.query.collections.findFirst({
      where: and(eq(collections.id, id), eq(collections.userId, user.id)),
    }),
    db.query.savedUrls.findFirst({
      where: and(eq(savedUrls.id, savedUrlId), eq(savedUrls.userId, user.id)),
    }),
  ]);
  if (!collection) throw new NotFoundError("Collection");
  if (!item) throw new NotFoundError("Saved URL");

  await db
    .insert(collectionItems)
    .values({ collectionId: id, savedUrlId })
    .onConflictDoNothing({
      target: [collectionItems.collectionId, collectionItems.savedUrlId],
    });

  return ok({ collectionId: id, savedUrlId }, { status: 201 });
});

collections_.delete("/:id/items/:savedUrlId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const savedUrlId = c.req.param("savedUrlId");
  const db = getDb();

  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, id), eq(collections.userId, user.id)),
  });
  if (!collection) throw new NotFoundError("Collection");

  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.collectionId, id), eq(collectionItems.savedUrlId, savedUrlId)));

  return ok({ collectionId: id, savedUrlId });
});

const summarizeSchema = z.object({ locale: z.enum(["en", "ja"]).optional() });

collections_.post("/:id/summarize", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { locale } = summarizeSchema.parse(await c.req.json().catch(() => ({})));
  const result = await summarizeCollection(user.id, id, locale);
  return ok(result);
});
