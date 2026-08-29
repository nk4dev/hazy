import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { readLaterState } from "@/db/schema";
import type { InboxItem } from "@/lib/read-later/bucketing";

/**
 * The user's current "read later" queue: items still in the inbox, plus
 * snoozed items whose snooze has come due. Shared between the read-later
 * API route (which buckets these for the digest view) and the Ask
 * pipeline (which needs the same list to answer questions like "what's in
 * my read later list", since that's app state — not something present in
 * any saved page's own content).
 */
export async function getReadLaterQueue(userId: string): Promise<InboxItem[]> {
  const db = getDb();
  const now = new Date();

  const rows = await db.query.readLaterState.findMany({
    where: and(
      eq(readLaterState.userId, userId),
      or(
        eq(readLaterState.status, "inbox"),
        and(eq(readLaterState.status, "snoozed"), lte(readLaterState.snoozedUntil, now))
      )
    ),
    with: { savedUrl: true },
  });

  return rows
    .filter((row): row is typeof row & { savedUrl: NonNullable<typeof row.savedUrl> } =>
      Boolean(row.savedUrl)
    )
    .map((row) => ({ ...row.savedUrl, readLater: row }));
}
