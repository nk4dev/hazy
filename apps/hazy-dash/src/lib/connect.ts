import { API_URL, HAZY_URL } from "./env";
import { pkceChallenge, randomToken } from "./pkce";

/**
 * "Connect with Hazy" from the client side. hazy-dash is a connected app, not
 * a hazy session: it sends the user to hazy's approval page with a PKCE
 * challenge, gets a one-shot code back on /callback and trades it at the
 * public `POST /v1/connect/token` for a long-lived `hz_…` bearer token.
 */

const TOKEN_KEY = "hazy-dash:token";
const PENDING_KEY = "hazy-dash:connect";

export const CLIENT_NAME = "Hazy Dash";

/**
 * Must be byte-identical in the authorize redirect and the token exchange —
 * the API compares strings. `localhost`, not `127.0.0.1`: CORS later matches
 * the browser's Origin against the origin stored with the token.
 */
export function redirectUri(): string {
  return new URL("/callback", window.location.origin).toString();
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Forgets the token locally. Revoking it for real happens in hazy's settings. */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function startConnect() {
  const verifier = randomToken();
  const state = randomToken();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));

  const url = new URL("/connector/add", HAZY_URL);
  url.searchParams.set("client_name", CLIENT_NAME);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

export type ConnectResult = { ok: true } | { ok: false; reason: "denied" | "state" | "exchange" };

let inFlight: Promise<ConnectResult> | null = null;

/**
 * Handles the /callback query. Codes are single-use, so this runs at most once
 * per page load even if React mounts the effect twice (StrictMode in dev).
 */
export function completeConnect(params: URLSearchParams): Promise<ConnectResult> {
  inFlight ??= exchange(params);
  return inFlight;
}

async function exchange(params: URLSearchParams): Promise<ConnectResult> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as { verifier: string; state: string }) : null;

  if (params.get("error")) return { ok: false, reason: "denied" };
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) {
    return { ok: false, reason: "state" };
  }

  const res = await fetch(new URL("/v1/connect/token", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, codeVerifier: pending.verifier, redirectUri: redirectUri() }),
  }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { data?: { accessToken: string } } | null;
  const token = json?.data?.accessToken;
  if (!res?.ok || !token) return { ok: false, reason: "exchange" };

  localStorage.setItem(TOKEN_KEY, token);
  return { ok: true };
}
