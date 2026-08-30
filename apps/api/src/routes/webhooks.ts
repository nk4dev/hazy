import { verifyWebhook, type WebhookEvent } from "@clerk/backend/webhooks";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { env, isClerkWebhookConfigured, isDatabaseConfigured } from "@/env";

export const webhooks = new Hono();

/**
 * Clerk user lifecycle → internal `users` table. Runs BEFORE the auth
 * middleware (Svix signature, not a Clerk session). Point the Clerk dashboard
 * webhook endpoint at `https://api.hz.nknighta.me/v1/webhooks/clerk`.
 */
webhooks.post("/clerk", async (c) => {
  if (!isClerkWebhookConfigured() || !isDatabaseConfigured()) {
    return c.text("Webhook not configured", 503);
  }

  let event: WebhookEvent;
  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    console.error("Clerk webhook verification failed:", error);
    return c.text("Verification failed", 400);
  }

  const db = getDb();

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = event.data;
    const email = email_addresses?.[0]?.email_address ?? null;
    const displayName = [first_name, last_name].filter(Boolean).join(" ") || null;

    const [user] = await db
      .insert(users)
      .values({ clerkId: id, email, displayName, avatarUrl: image_url ?? null })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { email, displayName, avatarUrl: image_url ?? null, updatedAt: new Date() },
      })
      .returning();

    if (user) {
      await db
        .insert(userPreferences)
        .values({ userId: user.id })
        .onConflictDoNothing({ target: userPreferences.userId });
    }
  }

  if (event.type === "user.deleted") {
    const { id } = event.data;
    if (id) {
      await db.delete(users).where(eq(users.clerkId, id));
    }
  }

  return c.text("OK", 200);
});
