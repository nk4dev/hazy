import type { WebhookEvent } from "@clerk/backend/webhooks";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { isClerkWebhookConfigured, isDatabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isClerkWebhookConfigured() || !isDatabaseConfigured()) {
    return new Response("Webhook not configured", { status: 503 });
  }

  let event: WebhookEvent;
  try {
    event = await verifyWebhook(req);
  } catch (error) {
    console.error("Clerk webhook verification failed:", error);
    return new Response("Verification failed", { status: 400 });
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

  return new Response("OK", { status: 200 });
}
