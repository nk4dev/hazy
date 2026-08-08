import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { readLaterState } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { bucketReadLaterItems, type InboxItem } from "@/lib/read-later/bucketing";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const user = await requireUser();
  const db = getDb();
  const now = new Date();

  const rows = await db.query.readLaterState.findMany({
    where: and(
      eq(readLaterState.userId, user.id),
      or(
        eq(readLaterState.status, "inbox"),
        and(eq(readLaterState.status, "snoozed"), lte(readLaterState.snoozedUntil, now))
      )
    ),
    with: { savedUrl: true },
  });

  const inboxItems: InboxItem[] = rows
    .filter((row) => row.savedUrl)
    .map((row) => ({ ...row.savedUrl!, readLater: row }));

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
