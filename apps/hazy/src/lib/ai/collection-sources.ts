import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionItems, collections } from "@/db/schema";
import type { SearchHit } from "@/lib/search/keyword-search";

export type CollectionSource = SearchHit & { collectionName: string };

// Caps how many links a set of @-mentioned collections can inject into the
// prompt — a large collection would otherwise blow the context budget.
const MAX_ATTACHED_SOURCES = 40;

/**
 * Loads the saved links inside the collections the user @-mentioned in an Ask
 * question. Only the caller's own collections are considered; unknown or
 * unowned ids are silently dropped. Links are deduped across collections
 * (first mention wins) and returned newest-first, pre-ranked so the Ask
 * pipeline can seed them straight into its citation list.
 */
export async function loadCollectionSources(
  userId: string,
  collectionIds: string[]
): Promise<{ names: string[]; hits: CollectionSource[] }> {
  if (collectionIds.length === 0) return { names: [], hits: [] };

  const db = getDb();
  const owned = await db.query.collections.findMany({
    where: and(inArray(collections.id, collectionIds), eq(collections.userId, userId)),
  });
  if (owned.length === 0) return { names: [], hits: [] };

  const nameById = new Map(owned.map((c) => [c.id, c.name]));
  const rows = await db.query.collectionItems.findMany({
    where: inArray(
      collectionItems.collectionId,
      owned.map((c) => c.id)
    ),
    with: { savedUrl: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const hits: CollectionSource[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.savedUrl || seen.has(row.savedUrl.id)) continue;
    seen.add(row.savedUrl.id);
    hits.push({
      ...row.savedUrl,
      rank: hits.length + 1,
      collectionName: nameById.get(row.collectionId) ?? "",
    });
    if (hits.length >= MAX_ATTACHED_SOURCES) break;
  }

  // Label uses the order the user listed the collections in, not DB order.
  const names = collectionIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name));

  return { names, hits };
}
