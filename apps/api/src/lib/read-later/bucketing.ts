import type { readLaterState, savedUrls } from "@/db/schema";

type SavedUrlRow = typeof savedUrls.$inferSelect;
type ReadLaterRow = typeof readLaterState.$inferSelect;

export type InboxItem = SavedUrlRow & { readLater: ReadLaterRow };

const TODAYS_THREE_COUNT = 3;
const FIVE_MINUTE_THRESHOLD = 5;

/**
 * No AI/ranking model backs this yet — it's a defensible heuristic: the
 * shortest, oldest-saved reads are the ones most likely to actually get
 * read today, so "today's three" favors short + long-waiting items over a
 * true relevance ranking (that's what Ask/RAG is for).
 */
export function bucketReadLaterItems(items: InboxItem[]) {
  const sorted = [...items].sort((a, b) => {
    const minutesA = a.estimatedReadMinutes ?? 15;
    const minutesB = b.estimatedReadMinutes ?? 15;
    if (minutesA !== minutesB) return minutesA - minutesB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const todaysThree = sorted.slice(0, TODAYS_THREE_COUNT);
  const todaysThreeIds = new Set(todaysThree.map((i) => i.id));
  const remaining = items
    .filter((i) => !todaysThreeIds.has(i.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const fiveMinutes = remaining.filter(
    (i) => (i.estimatedReadMinutes ?? 99) <= FIVE_MINUTE_THRESHOLD
  );
  const sitDown = remaining.filter((i) => (i.estimatedReadMinutes ?? 99) > FIVE_MINUTE_THRESHOLD);

  const totalMinutes = items.reduce((sum, i) => sum + (i.estimatedReadMinutes ?? 0), 0);
  const todaysThreeMinutes = todaysThree.reduce((sum, i) => sum + (i.estimatedReadMinutes ?? 0), 0);

  return { todaysThree, fiveMinutes, sitDown, totalMinutes, todaysThreeMinutes };
}
