import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { getDb } from "@/db";
import { apiTokens, connectCodes } from "@/db/schema";
import { ApiError, NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { API_TOKEN_PREFIX, pkceChallenge, randomSecret, sha256Hex } from "@/lib/auth/api-token";
import type { AppEnv } from "@/types/hono";

/**
 * "Connect with Hazy" — an OAuth-style authorization-code + PKCE (S256) flow
 * for third-party clients (no client registration; the redirect URI's origin
 * is the client's identity):
 *
 *   1. client → hazy `/connector/add?client_name&redirect_uri&code_challenge&state`
 *   2. the signed-in user approves → `POST /v1/connect/authorize` → `{ code }`
 *   3. hazy redirects to `redirect_uri?code&state`
 *   4. client → `POST /v1/connect/token` (public) → `{ accessToken: "hz_…" }`
 *
 * `connectToken` is mounted *outside* the authed group; `connect` inside it.
 */

const CODE_TTL_MS = 5 * 60 * 1000;

const redirectUriSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    // Plain http only for local clients.
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  }, "redirect_uri must be https (or http on localhost) without a fragment");

/** Connection management needs a real Clerk session — a connected app can't mint or revoke tokens. */
const requireClerkSession = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("authVia") !== "clerk") {
    throw new ApiError(403, "forbidden", "Not available to connected apps.");
  }
  await next();
});

export const connect = new Hono<AppEnv>();
connect.use("*", requireClerkSession);

const authorizeSchema = z.object({
  clientName: z.string().trim().min(1).max(100),
  redirectUri: redirectUriSchema,
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  codeChallengeMethod: z.literal("S256"),
});

connect.post("/authorize", async (c) => {
  const user = c.get("user");
  const body = authorizeSchema.parse(await c.req.json());
  const code = randomSecret();

  await getDb()
    .insert(connectCodes)
    .values({
      codeHash: await sha256Hex(code),
      userId: user.id,
      clientName: body.clientName,
      redirectUri: body.redirectUri,
      codeChallenge: body.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

  return ok({ code }, { status: 201 });
});

connect.get("/apps", async (c) => {
  const user = c.get("user");
  const rows = await getDb().query.apiTokens.findMany({
    where: and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)),
    orderBy: [desc(apiTokens.createdAt)],
  });
  return ok({
    items: rows.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      clientOrigin: row.clientOrigin,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    })),
  });
});

connect.delete("/apps/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [row] = await getDb()
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (!row) throw new NotFoundError("Connected app");
  return ok({ id: row.id });
});

export const connectToken = new Hono<AppEnv>();

const tokenSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  redirectUri: z.string().min(1),
});

const invalidGrant = () => new ApiError(400, "invalid_grant", "Code is invalid or expired.");

connectToken.post("/", async (c) => {
  const body = tokenSchema.parse(await c.req.json());
  const db = getDb();

  // Delete-on-read: a code is single-use even if the checks below fail.
  const [row] = await db
    .delete(connectCodes)
    .where(eq(connectCodes.codeHash, await sha256Hex(body.code)))
    .returning();
  if (
    !row ||
    row.expiresAt.getTime() < Date.now() ||
    row.redirectUri !== body.redirectUri ||
    row.codeChallenge !== (await pkceChallenge(body.codeVerifier))
  ) {
    throw invalidGrant();
  }

  const accessToken = randomSecret(API_TOKEN_PREFIX);
  await db.insert(apiTokens).values({
    userId: row.userId,
    tokenHash: await sha256Hex(accessToken),
    clientName: row.clientName,
    clientOrigin: new URL(row.redirectUri).origin,
  });

  return ok({ accessToken, tokenType: "Bearer" as const, clientName: row.clientName });
});
