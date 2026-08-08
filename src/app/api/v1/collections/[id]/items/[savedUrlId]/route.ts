import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collections, collectionItems } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { NotFoundError } from "@/lib/api/errors";

export const runtime = "nodejs";

export const DELETE = withApiErrors(
  async (
    _req: Request,
    { params }: { params: Promise<{ id: string; savedUrlId: string }> }
  ) => {
    const user = await requireUser();
    const { id, savedUrlId } = await params;
    const db = getDb();

    const collection = await db.query.collections.findFirst({
      where: and(eq(collections.id, id), eq(collections.userId, user.id)),
    });
    if (!collection) throw new NotFoundError("Collection");

    await db
      .delete(collectionItems)
      .where(
        and(eq(collectionItems.collectionId, id), eq(collectionItems.savedUrlId, savedUrlId))
      );

    return ok({ collectionId: id, savedUrlId });
  }
);
