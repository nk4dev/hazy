import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { ok } from "@/lib/api/response";
import type { AppEnv } from "@/types/hono";

export const me = new Hono<AppEnv>();

const DEFAULT_PREFERENCES = {
  interfaceLocale: "en",
  answerLanguageMode: "interface",
  notifyReadLaterDigest: true,
  notifyWeeklyStats: false,
} as const;

function toPreferencesDto(row: typeof userPreferences.$inferSelect | undefined) {
  return {
    interfaceLocale: row?.interfaceLocale ?? DEFAULT_PREFERENCES.interfaceLocale,
    answerLanguageMode: row?.answerLanguageMode ?? DEFAULT_PREFERENCES.answerLanguageMode,
    notifyReadLaterDigest: row?.notifyReadLaterDigest ?? DEFAULT_PREFERENCES.notifyReadLaterDigest,
    notifyWeeklyStats: row?.notifyWeeklyStats ?? DEFAULT_PREFERENCES.notifyWeeklyStats,
  };
}

me.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb();
  const preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, user.id),
  });

  return ok({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferences: toPreferencesDto(preferences),
  });
});

const updateSchema = z.object({
  interfaceLocale: z.enum(["en", "ja"]).optional(),
  answerLanguageMode: z.enum(["interface", "source"]).optional(),
  notifyReadLaterDigest: z.boolean().optional(),
  notifyWeeklyStats: z.boolean().optional(),
});

me.patch("/", async (c) => {
  const user = c.get("user");
  const body = updateSchema.parse(await c.req.json());
  const db = getDb();

  const [updated] = await db
    .insert(userPreferences)
    .values({ userId: user.id, ...body })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...body, updatedAt: new Date() },
    })
    .returning();

  return ok(toPreferencesDto(updated));
});
