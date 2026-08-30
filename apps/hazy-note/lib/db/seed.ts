import { db, schema } from "./index";

/**
 * First-run setup for a brand-new user. The app starts empty — every surface is
 * built from the user's own captures, and projects are created deliberately by
 * the user. The one exception is a plain "あとで読む" bucket for the inbox.
 */
export async function seedForUser(userId: string) {
  const already = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  if (already) return;

  await db.insert(schema.collections).values([{ userId, name: "あとで読む", tone: "neutral" }]);
}
