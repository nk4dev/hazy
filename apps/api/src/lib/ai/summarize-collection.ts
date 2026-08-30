import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionItems, collections, userPreferences } from "@/db/schema";
import { askOpenRouter } from "@/lib/ai/openrouter";
import { buildCollectionSummaryPrompt } from "@/lib/ai/prompt-templates";
import { NotFoundError, ServiceNotConfiguredError, ValidationError } from "@/lib/api/errors";
import { isOpenRouterConfigured } from "@/env";

export type CollectionSummary = { summary: string; summaryUpdatedAt: string };

export async function summarizeCollection(
  userId: string,
  collectionId: string,
  requestedLocale?: string
): Promise<CollectionSummary> {
  if (!isOpenRouterConfigured()) {
    throw new ServiceNotConfiguredError("openrouter");
  }

  const db = getDb();
  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, collectionId), eq(collections.userId, userId)),
  });
  if (!collection) throw new NotFoundError("Collection");

  const rows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collectionId),
    with: { savedUrl: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const items = rows.map((r) => r.savedUrl).filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (items.length === 0) {
    throw new ValidationError("This collection has no links to summarize yet.");
  }

  // The active UI locale (sent by the client) is the source of truth so the
  // summary matches the language the user is reading the app in right now;
  // the stored preference is only a fallback for callers that don't pass one.
  let targetLanguage = requestedLocale;
  if (!targetLanguage) {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    targetLanguage = prefs?.interfaceLocale ?? "en";
  }

  const summary = await askOpenRouter([
    {
      role: "user",
      content: buildCollectionSummaryPrompt(
        { name: collection.name, description: collection.description },
        items,
        targetLanguage
      ),
    },
  ]);

  const summaryUpdatedAt = new Date();
  await db
    .update(collections)
    .set({ summary: summary.trim(), summaryUpdatedAt, updatedAt: summaryUpdatedAt })
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));

  return { summary: summary.trim(), summaryUpdatedAt: summaryUpdatedAt.toISOString() };
}
