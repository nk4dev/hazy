import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { readLaterState, savedUrls } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = withApiErrors(async () => {
  const user = await requireUser();
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

  // 7 buckets, oldest -> newest, counting items read that day.
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(Date.now() - (6 - i) * DAY_MS);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const count = readRows.filter(
      (r) => r.markedReadAt && r.markedReadAt >= dayStart && r.markedReadAt < dayEnd
    ).length;
    return count;
  });

  const maxDay = Math.max(1, ...days);

  return ok({
    days: days.map((count) => ({ count, heightPct: Math.round((count / maxDay) * 100) })),
    readThisWeek: readRows.length,
    savedThisWeek: savedRows.length,
  });
});
