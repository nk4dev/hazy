import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { collectionItems, collections } from "@/db/schema";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { serializeCollection } from "@/lib/serializers";

export const runtime = "nodejs";

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

  return ok({
    items: rows.map(({ collection, itemCount }) => serializeCollection(collection, itemCount)),
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
