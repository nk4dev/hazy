import { db, schema } from "./index";

/**
 * First-run setup for a brand-new user. The app used to seed a full demo
 * workspace here; it now starts empty and every surface is built from the
 * user's own captures. We still create the three default collections so the
 * sidebar and "振り分け" have somewhere to put things — the accent one is the
 * default destination the digest and auto-sort target.
 */
export async function seedForUser(userId: string) {
  const already = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  if (already) return;

  await db.insert(schema.collections).values([
    { userId, name: "いま気になっていること", tone: "accent" },
    { userId, name: "あとで読む", tone: "neutral" },
  ]);
}
