import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "@/env";
import { fail } from "@/lib/api/response";
import { isConnectedOrigin } from "@/lib/auth/api-token";
import { authMiddleware } from "@/middleware/auth";
import { ai } from "@/routes/ai";
import { ask } from "@/routes/ask";
import { collections_ } from "@/routes/collections";
import { connect, connectToken } from "@/routes/connect";
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
    "http://localhost:3000",
    "https://hz.nknighta.me",
    "https://note.hz.nknighta.me",
    "https://pctunnel.nknighta.me",
    "https://pctunnel-api.nknighta.me",
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
      origin: async (origin, c) => {
        if (allowedOrigins().includes(origin)) return origin;
        // "Connect with Hazy": the code exchange comes from a client we don't
        // know yet (PKCE is the proof), and afterwards that client's origin is
        // allowed for as long as it holds an unrevoked `hz_…` token.
        if (c.req.path === "/v1/connect/token") return origin;
        return (await isConnectedOrigin(origin)) ? origin : null;
      },
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
  // Code → token exchange: the client has no session yet, PKCE is the proof.
  app.route("/v1/connect/token", connectToken);

  const v1 = new Hono<AppEnv>();
  v1.use("*", authMiddleware);
  v1.route("/items", items);
  v1.route("/collections", collections_);
  v1.route("/ask", ask);
  v1.route("/read-later", readLater);
  v1.route("/search", search);
  v1.route("/me", me);
  v1.route("/connect", connect);
  v1.route("/ai", ai);
  app.route("/v1", v1);

  return app;
}
