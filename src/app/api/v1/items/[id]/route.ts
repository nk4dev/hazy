import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { savedUrls } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

async function loadOwnedItem(userId: string, id: string) {
  const db = getDb();
  const row = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.id, id), eq(savedUrls.userId, userId)),
    with: { readLaterState: true },
  });
  if (!row) throw new NotFoundError("Saved URL");
  return row;
}

export const GET = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const row = await loadOwnedItem(user.id, id);
    return ok(serializeSavedUrl(row, row.readLaterState));
  }
);

const patchSchema = z.object({
  summary: z.string().max(4000).nullable().optional(),
  title: z.string().max(500).nullable().optional(),
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedItem(user.id, id);
    const body = patchSchema.parse(await req.json());
    const db = getDb();
    const [updated] = await db
      .update(savedUrls)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)))
      .returning();
    return ok(serializeSavedUrl(updated));
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedItem(user.id, id);
    const db = getDb();
    await db.delete(savedUrls).where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)));
    return ok({ id });
  }
);
