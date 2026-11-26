import { Hono } from "hono";
import { isBetterAuthConfigured, isGithubOAuthConfigured } from "@/env";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";
import { isConnectedOrigin } from "@/lib/auth/api-token";
import { getAuth } from "@/lib/auth/better-auth";
import { isAllowedOrigin } from "@/lib/auth/origins";
import { authMiddleware } from "@/middleware/auth";
import { ask } from "@/routes/ask";
import { collections_ } from "@/routes/collections";
import { connect, connectToken } from "@/routes/connect";
import { items } from "@/routes/items";
import { me } from "@/routes/me";
import { noteRoutes } from "@/routes/note";
import { readLater } from "@/routes/read-later";
import { search } from "@/routes/search";
import { webhooks } from "@/routes/webhooks";
import type { AppEnv } from "@/types/hono";

function applyCorsHeaders(
  setHeader: (name: string, value: string) => void,
  opts: {
    allowOrigin: string | null;
    allowCredentials: boolean;
    allowMethods: string;
    allowHeaders: string;
  }
) {
  if (!opts.allowOrigin) return;
  setHeader("Access-Control-Allow-Origin", opts.allowOrigin);
  setHeader("Vary", "Origin");
  if (opts.allowCredentials) {
    setHeader("Access-Control-Allow-Credentials", "true");
  }
  setHeader("Access-Control-Allow-Methods", opts.allowMethods);
  setHeader("Access-Control-Allow-Headers", opts.allowHeaders);
  setHeader("Access-Control-Max-Age", "86400");
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("/api/auth/*", async (c, next) => {
    const origin = c.req.header("Origin");
    const corsOpts = {
      allowOrigin: isAllowedOrigin(origin) ? origin : null,
      allowCredentials: isAllowedOrigin(origin),
      allowMethods: "GET, POST, OPTIONS",
      allowHeaders: "Content-Type, Authorization",
    };

    if (c.req.method === "OPTIONS") {
      applyCorsHeaders((name, value) => c.header(name, value), corsOpts);
      return c.body(null, 204);
    }

    await next();
    applyCorsHeaders((name, value) => c.header(name, value), corsOpts);
  });

  app.on(["POST", "GET"], "/api/auth/*", (c) => {
    if (!isBetterAuthConfigured()) {
      return fail(new ServiceNotConfiguredError("better_auth"));
    }
    return getAuth().handler(c.req.raw);
  });

  app.use("/v1/*", async (c, next) => {
    const origin = c.req.header("Origin");

    // "Connect with Hazy": the code exchange comes from a client we don't
    // know yet (PKCE is the proof), so any origin may POST without credentials.
    if (c.req.path === "/v1/connect/token") {
      const tokenCors = {
        allowOrigin: origin ?? null,
        allowCredentials: false,
        allowMethods: "POST, OPTIONS",
        allowHeaders: "Content-Type",
      };
      if (c.req.method === "OPTIONS") {
        applyCorsHeaders((name, value) => c.header(name, value), tokenCors);
        return c.body(null, 204);
      }
      await next();
      applyCorsHeaders((name, value) => c.header(name, value), tokenCors);
      return;
    }

    let allowOrigin: string | null = null;
    let allowCredentials = false;
    if (isAllowedOrigin(origin)) {
      allowOrigin = origin;
      allowCredentials = true;
    } else if (origin && (await isConnectedOrigin(origin))) {
      allowOrigin = origin;
    }

    const apiCors = {
      allowOrigin,
      allowCredentials,
      allowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      allowHeaders: "Content-Type, Authorization",
    };

    if (c.req.method === "OPTIONS") {
      applyCorsHeaders((name, value) => c.header(name, value), apiCors);
      return c.body(null, 204);
    }

    try {
      await next();
    } finally {
      applyCorsHeaders((name, value) => c.header(name, value), apiCors);
    }
  });

  // Every thrown ApiError / ZodError -> shared envelope; anything else -> 500.
  app.onError((err) => fail(err));

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/v1/auth-config", (_c) =>
    ok({
      betterAuth: isBetterAuthConfigured(),
      github: isGithubOAuthConfigured(),
      passkey: isBetterAuthConfigured(),
    })
  );

  // Webhook (Svix signature, not a user session): registered before the authed
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
  v1.route("/note", noteRoutes);
  app.route("/v1", v1);

  return app;
}
