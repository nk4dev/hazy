import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { collections, collectionItems, savedUrls } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { NotFoundError } from "@/lib/api/errors";

export const runtime = "nodejs";

const addSchema = z.object({ savedUrlId: z.string().uuid() });

export const POST = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const { savedUrlId } = addSchema.parse(await req.json());
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
  }
);
