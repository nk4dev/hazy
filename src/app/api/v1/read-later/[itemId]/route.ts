import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { readLaterState, savedUrls } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { NotFoundError } from "@/lib/api/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["inbox", "snoozed", "read", "archived"]),
  snoozedUntil: z.string().datetime().optional(),
});

export const PATCH = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ itemId: string }> }) => {
    const user = await requireUser();
    const { itemId } = await params;
    const body = patchSchema.parse(await req.json());
    const db = getDb();

    const owned = await db.query.savedUrls.findFirst({
      where: and(eq(savedUrls.id, itemId), eq(savedUrls.userId, user.id)),
    });
    if (!owned) throw new NotFoundError("Saved URL");

    const [updated] = await db
      .insert(readLaterState)
      .values({
        userId: user.id,
        savedUrlId: itemId,
        status: body.status,
        snoozedUntil: body.snoozedUntil ? new Date(body.snoozedUntil) : null,
        markedReadAt: body.status === "read" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [readLaterState.userId, readLaterState.savedUrlId],
        set: {
          status: body.status,
          snoozedUntil: body.snoozedUntil ? new Date(body.snoozedUntil) : null,
          markedReadAt: body.status === "read" ? new Date() : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return ok(updated);
  }
);
