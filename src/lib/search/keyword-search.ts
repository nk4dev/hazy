import { and, desc, eq, or, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { savedUrls } from "@/db/schema";

export type SearchHit = typeof savedUrls.$inferSelect & { rank: number };

/**
 * Always-available search over a user's own saved URLs — no AI required.
 * Tries Postgres full-text search first (fast, ranked); if that comes back
 * empty (e.g. a short/odd query the tsquery parser doesn't like), falls
 * back to a plain ILIKE scan so search never just returns nothing.
 */
export async function searchUserItems(
  userId: string,
  query: string,
  { limit = 8 }: { limit?: number } = {}
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();

  const ftsRows = await db
    .select({
      row: savedUrls,
      rank: sql<number>`ts_rank(${savedUrls.searchVector}, plainto_tsquery('simple', ${trimmed}))`,
    })
    .from(savedUrls)
    .where(
      and(
        eq(savedUrls.userId, userId),
        sql`${savedUrls.searchVector} @@ plainto_tsquery('simple', ${trimmed})`
      )
    )
    .orderBy((t) => desc(t.rank))
    .limit(limit);

  if (ftsRows.length > 0) {
    return ftsRows.map(({ row, rank }) => ({ ...row, rank }));
  }

  const likeTerm = `%${trimmed}%`;
  const likeRows = await db
    .select()
    .from(savedUrls)
    .where(
      and(
        eq(savedUrls.userId, userId),
        or(
          ilike(savedUrls.title, likeTerm),
          ilike(savedUrls.description, likeTerm),
          ilike(savedUrls.summary, likeTerm),
          ilike(savedUrls.domain, likeTerm),
          ilike(savedUrls.extractedText, likeTerm)
        )
      )
    )
    .orderBy(desc(savedUrls.createdAt))
    .limit(limit);

  return likeRows.map((row) => ({ ...row, rank: 0 }));
}
