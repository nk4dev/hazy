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

/** Lowercase, trim, drop blanks/overlong entries, de-dupe, cap the list. */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag && tag.length <= 50) seen.add(tag);
  }
  return [...seen].slice(0, 30);
}

const patchSchema = z.object({
  summary: z.string().max(4000).nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  tags: z.array(z.string()).max(100).optional(),
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedItem(user.id, id);
    const { tags, ...body } = patchSchema.parse(await req.json());
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
