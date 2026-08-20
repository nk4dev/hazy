import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const user = await requireUser();
  const db = getDb();
  const preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, user.id),
  });

  return ok({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferences: preferences ?? {
      interfaceLocale: "en",
      answerLanguageMode: "interface",
      notifyReadLaterDigest: true,
      notifyWeeklyStats: false,
    },
  });
});

const updateSchema = z.object({
  interfaceLocale: z.enum(["en", "ja"]).optional(),
  answerLanguageMode: z.enum(["interface", "source"]).optional(),
  notifyReadLaterDigest: z.boolean().optional(),
  notifyWeeklyStats: z.boolean().optional(),
});

export const PATCH = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const body = updateSchema.parse(await req.json());
  const db = getDb();

  const [updated] = await db
    .insert(userPreferences)
    .values({ userId: user.id, ...body })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...body, updatedAt: new Date() },
    })
    .returning();

  return ok(updated);
});
