import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { collectionItems, collections } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

async function loadOwnedCollection(userId: string, id: string) {
  const db = getDb();
  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, id), eq(collections.userId, userId)),
  });
  if (!collection) throw new NotFoundError("Collection");
  return collection;
}

export const GET = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const collection = await loadOwnedCollection(user.id, id);
    const db = getDb();

    const rows = await db.query.collectionItems.findMany({
      where: eq(collectionItems.collectionId, id),
      with: { savedUrl: { with: { readLaterState: true } } },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return ok({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      color: collection.color,
      summary: collection.summary,
      summaryUpdatedAt: collection.summaryUpdatedAt?.toISOString() ?? null,
      items: rows
        .filter((r): r is typeof r & { savedUrl: NonNullable<typeof r.savedUrl> } =>
          Boolean(r.savedUrl)
        )
        .map((r) => serializeSavedUrl(r.savedUrl, r.savedUrl.readLaterState)),
    });
  }
);

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedCollection(user.id, id);
    const body = patchSchema.parse(await req.json());
    const db = getDb();
    const [updated] = await db
      .update(collections)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(collections.id, id), eq(collections.userId, user.id)))
      .returning();
    return ok(updated);
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedCollection(user.id, id);
    const db = getDb();
    await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, user.id)));
    return ok({ id });
  }
);
