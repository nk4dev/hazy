import type { collections, readLaterState, savedUrls } from "@/db/schema";
import type { CollectionDTO, SavedUrlDTO } from "@/types/api";

export type SavedUrlRow = typeof savedUrls.$inferSelect;
export type SavedUrlSummaryRow = Omit<SavedUrlRow, "extractedText" | "searchVector">;
type ReadLaterRow = typeof readLaterState.$inferSelect;
type CollectionRow = typeof collections.$inferSelect;

/** Exclude large/unused full-text columns on list, detail, queue, and citation queries. */
export const SAVED_URL_SUMMARY_COLUMNS = {
  extractedText: false,
  searchVector: false,
} as const;

export function serializeSavedUrl(
  row: SavedUrlSummaryRow,
  readLater?: ReadLaterRow | null,
  collectionIds: string[] = []
): SavedUrlDTO {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    description: row.description,
    faviconUrl: row.faviconUrl,
    ogImageUrl: row.ogImageUrl,
    summary: row.summary,
    tags: row.tags ?? [],
    contentLanguage: row.contentLanguage,
    estimatedReadMinutes: row.estimatedReadMinutes,
    fetchStatus: row.fetchStatus,
    fetchError: row.fetchError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readLaterStatus: readLater?.status ?? null,
    collectionIds,
  };
}

export function serializeCollection(
  row: CollectionRow,
  itemCount: number,
  previewImages: string[] = []
): CollectionDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    summary: row.summary,
    summaryUpdatedAt: row.summaryUpdatedAt?.toISOString() ?? null,
    itemCount,
    previewImages,
    createdAt: row.createdAt.toISOString(),
  };
}
