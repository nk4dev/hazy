import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { collectionItems, collections, savedUrls } from "@/db/schema";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { serializeCollection } from "@/lib/serializers";

export const runtime = "nodejs";

const PREVIEW_IMAGES_PER_COLLECTION = 4;

/**
 * Collects up to {@link PREVIEW_IMAGES_PER_COLLECTION} recent og:image URLs
 * for each collection so the collections grid can render a preview thumbnail
 * built from the images of the links saved inside it.
 */
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

export const GET = withApiErrors(async () => {
  const user = await requireUser();
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

export const POST = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const body = createSchema.parse(await req.json());
  const db = getDb();

  const [row] = await db
    .insert(collections)
    .values({ userId: user.id, ...body })
    .returning();

  return ok(serializeCollection(row, 0), { status: 201 });
});
