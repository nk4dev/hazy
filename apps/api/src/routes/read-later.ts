import { and, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { readLaterState, savedUrls } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { bucketReadLaterItems } from "@/lib/read-later/bucketing";
import { getReadLaterQueue } from "@/lib/read-later/get-queue";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const readLater = new Hono<AppEnv>();

const DAY_MS = 24 * 60 * 60 * 1000;

readLater.get("/", async (c) => {
  const user = c.get("user");
  const inboxItems = await getReadLaterQueue(user.id);

  const { todaysThree, fiveMinutes, sitDown, totalMinutes, todaysThreeMinutes } =
    bucketReadLaterItems(inboxItems);

  return ok({
    totalCount: inboxItems.length,
    totalMinutes,
    todaysThreeMinutes,
    todaysThree: todaysThree.map((i) => serializeSavedUrl(i, i.readLater)),
    fiveMinutes: fiveMinutes.map((i) => serializeSavedUrl(i, i.readLater)),
    sitDown: sitDown.map((i) => serializeSavedUrl(i, i.readLater)),
  });
});

readLater.get("/stats", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const weekAgo = new Date(Date.now() - 7 * DAY_MS);

  const [readRows, savedRows] = await Promise.all([
    db.query.readLaterState.findMany({
      where: and(
        eq(readLaterState.userId, user.id),
        eq(readLaterState.status, "read"),
        gte(readLaterState.markedReadAt, weekAgo)
      ),
    }),
    db.query.savedUrls.findMany({
      where: and(eq(savedUrls.userId, user.id), gte(savedUrls.createdAt, weekAgo)),
    }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(Date.now() - (6 - i) * DAY_MS);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    return readRows.filter(
      (r) => r.markedReadAt && r.markedReadAt >= dayStart && r.markedReadAt < dayEnd
    ).length;
  });

  const maxDay = Math.max(1, ...days);

  return ok({
    days: days.map((n) => ({ count: n, heightPct: Math.round((n / maxDay) * 100) })),
    readThisWeek: readRows.length,
    savedThisWeek: savedRows.length,
  });
});

const patchSchema = z.object({
  status: z.enum(["inbox", "snoozed", "read", "archived"]),
  snoozedUntil: z.string().datetime().optional(),
});

readLater.patch("/:itemId", async (c) => {
  const user = c.get("user");
  const itemId = c.req.param("itemId");
  const body = patchSchema.parse(await c.req.json());
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

  return ok({
    status: updated.status,
    snoozedUntil: updated.snoozedUntil?.toISOString() ?? null,
    markedReadAt: updated.markedReadAt?.toISOString() ?? null,
  });
});
