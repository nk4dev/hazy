import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { apiTokens, users } from "@/db/schema";
import type { AppUser } from "@/lib/auth/current-user";

/** Prefix that tells `authMiddleware` a bearer is a connected-app token, not a Clerk JWT. */
export const API_TOKEN_PREFIX = "hz_";

/** Don't write `last_used_at` on every request — once an hour is plenty. */
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomSecret(prefix = ""): string {
  return prefix + base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PKCE S256: base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/**
 * Resolves an `hz_…` bearer to its user, or null when unknown / revoked.
 * Connected apps never create users — the row always exists, since issuing a
 * token required a Clerk session first.
 */
export async function resolveApiToken(token: string): Promise<AppUser | null> {
  const db = getDb();
  const row = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, await sha256Hex(token)), isNull(apiTokens.revokedAt)),
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!user) return null;

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  }
  return user;
}

/** CORS: is `origin` a connected app with at least one live token? */
export async function isConnectedOrigin(origin: string): Promise<boolean> {
  if (!origin) return false;
  const row = await getDb().query.apiTokens.findFirst({
    columns: { id: true },
    where: and(eq(apiTokens.clientOrigin, origin), isNull(apiTokens.revokedAt)),
  });
  return Boolean(row);
}
