import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@/db";
import { blogConnections } from "@/db/schema";
import { decryptCredentials } from "@/lib/blog/crypto";
import { getBlogProvider } from "@/lib/blog/providers";
import { syncBlogPostsIncremental } from "@/lib/blog/sync";

export const blogWebhooks = new Hono();

blogWebhooks.post("/:webhookToken", async (c) => {
  const token = c.req.param("webhookToken");
  const db = getDb();
  const conn = await db.query.blogConnections.findFirst({
    where: eq(blogConnections.webhookToken, token),
  });
  if (!conn || !conn.isEnabled) {
    return c.json({ ok: false, error: "Unknown webhook" }, 404);
  }

  const rawBody = await c.req.text();
  try {
    const creds = await decryptCredentials<Record<string, unknown>>(conn.encryptedCredentials);
    const parsed = await getBlogProvider(conn.provider).parseWebhook(
      c.req.raw.headers,
      rawBody,
      conn.config,
      creds
    );
    if (parsed.unsupported) {
      return c.json({ ok: true, skipped: true });
    }
    const result = await syncBlogPostsIncremental(
      db,
      conn,
      parsed.upsertPosts,
      parsed.deletedExternalIds
    );
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook failed";
    await db
      .update(blogConnections)
      .set({ lastSyncError: message, updatedAt: new Date() })
      .where(eq(blogConnections.id, conn.id));
    return c.json({ ok: false, error: message }, 400);
  }
});
