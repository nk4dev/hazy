import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "@/env";
import { fail } from "@/lib/api/response";
import { authMiddleware } from "@/middleware/auth";
import { ask } from "@/routes/ask";
import { collections_ } from "@/routes/collections";
import { items } from "@/routes/items";
import { me } from "@/routes/me";
import { readLater } from "@/routes/read-later";
import { search } from "@/routes/search";
import { webhooks } from "@/routes/webhooks";
import type { AppEnv } from "@/types/hono";

function allowedOrigins(): string[] {
  return [
    env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3100",
    ...(env.CORS_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []),
  ];
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use(
    "/v1/*",
    cors({
      origin: (origin) => (allowedOrigins().includes(origin) ? origin : null),
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: false,
      maxAge: 86400,
    })
  );

  // Every thrown ApiError / ZodError -> shared envelope; anything else -> 500.
  app.onError((err) => fail(err));

  app.get("/health", (c) => c.json({ ok: true }));

  // Webhook (Svix signature, not a Clerk session): registered before the authed
  // group so its handler runs and returns before `authMiddleware` in the chain.
  app.route("/v1/webhooks", webhooks);

  const v1 = new Hono<AppEnv>();
  v1.use("*", authMiddleware);
  v1.route("/items", items);
  v1.route("/collections", collections_);
  v1.route("/ask", ask);
  v1.route("/read-later", readLater);
  v1.route("/search", search);
  v1.route("/me", me);
  app.route("/v1", v1);

  return app;
}
