import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { savedUrls, userPreferences } from "@/db/schema";
import { askOpenRouter } from "@/lib/ai/openrouter";
import { buildSummarizePrompt } from "@/lib/ai/prompt-templates";
import { NotFoundError, ServiceNotConfiguredError } from "@/lib/api/errors";
import { isOpenRouterConfigured } from "@/env";
import { serializeSavedUrl } from "@/lib/serializers";
import type { SavedUrlDTO } from "@/types/api";

export async function summarizeItem(userId: string, itemId: string): Promise<SavedUrlDTO> {
  if (!isOpenRouterConfigured()) {
    throw new ServiceNotConfiguredError("openrouter");
  }

  const db = getDb();
  const item = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.id, itemId), eq(savedUrls.userId, userId)),
    with: { readLaterState: true },
  });
  if (!item) throw new NotFoundError("Saved URL");

  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  const targetLanguage =
    prefs?.answerLanguageMode === "source" && item.contentLanguage
      ? item.contentLanguage
      : (prefs?.interfaceLocale ?? "en");

  const summary = await askOpenRouter([
    { role: "user", content: buildSummarizePrompt(item, targetLanguage) },
  ]);

  const [updated] = await db
    .update(savedUrls)
    .set({ summary: summary.trim(), updatedAt: new Date() })
    .where(and(eq(savedUrls.id, itemId), eq(savedUrls.userId, userId)))
    .returning();

  return serializeSavedUrl(updated, item.readLaterState);
}
