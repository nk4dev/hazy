import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { getDb } from "@/db";
import { apiTokens, connectCodes, profiles } from "@/db/schema";
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

/** Connection management needs an interactive user session — a connected app can't mint or revoke tokens. */
const requireUserSession = createMiddleware<AppEnv>(async (c, next) => {
  const authVia = c.get("authVia");
  if (authVia !== "better_auth" && authVia !== "clerk") {
    throw new ApiError(403, "forbidden", "Not available to connected apps.");
  }
  await next();
});

export const connect = new Hono<AppEnv>();
connect.use("*", requireUserSession);

const authorizeSchema = z.object({
  clientName: z.string().trim().min(1).max(100),
  redirectUri: redirectUriSchema,
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  codeChallengeMethod: z.literal("S256"),
  profileId: z.string().uuid().optional(),
});

connect.post("/authorize", async (c) => {
  const user = c.get("user");
  const activeProfile = c.get("profile");
  const body = authorizeSchema.parse(await c.req.json());
  const db = getDb();

  let targetProfileId = activeProfile.id;
  if (body.profileId) {
    const owned = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, body.profileId), eq(profiles.userId, user.id)),
    });
    if (!owned) throw new NotFoundError("Profile");
    targetProfileId = owned.id;
  }

  const code = randomSecret();

  await db.insert(connectCodes).values({
    codeHash: await sha256Hex(code),
    userId: user.id,
    profileId: targetProfileId,
    clientName: body.clientName,
    redirectUri: body.redirectUri,
    codeChallenge: body.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return ok({ code }, { status: 201 });
});

connect.get("/apps", async (c) => {
  const user = c.get("user");
  const rows = await getDb()
    .select({
      id: apiTokens.id,
      clientName: apiTokens.clientName,
      clientOrigin: apiTokens.clientOrigin,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      profileId: apiTokens.profileId,
      profileSlug: profiles.slug,
      profileName: profiles.name,
    })
    .from(apiTokens)
    .leftJoin(profiles, eq(apiTokens.profileId, profiles.id))
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));

  return ok({
    items: rows.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      clientOrigin: row.clientOrigin,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      profileId: row.profileId,
      profileSlug: row.profileSlug ?? "personal",
      profileName: row.profileName ?? "Personal",
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
    profileId: row.profileId,
    tokenHash: await sha256Hex(accessToken),
    clientName: row.clientName,
    clientOrigin: new URL(row.redirectUri).origin,
  });

  const profileRow = await db.query.profiles.findFirst({
    where: eq(profiles.id, row.profileId),
  });

  return ok({
    accessToken,
    tokenType: "Bearer" as const,
    clientName: row.clientName,
    ...(profileRow
      ? { profile: { id: profileRow.id, slug: profileRow.slug, name: profileRow.name } }
      : {}),
  });
});
