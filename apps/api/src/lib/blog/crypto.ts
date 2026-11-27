import { env, isBlogCredentialsConfigured } from "@/env";
import { ServiceNotConfiguredError } from "@/lib/api/errors";

const IV_LENGTH = 12;

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function importAesKey(): Promise<CryptoKey> {
  if (!isBlogCredentialsConfigured() || !env.BLOG_CREDENTIALS_KEY) {
    throw new ServiceNotConfiguredError("blog_credentials");
  }
  const raw = decodeBase64(env.BLOG_CREDENTIALS_KEY.trim());
  if (raw.byteLength !== 32) {
    throw new Error("BLOG_CREDENTIALS_KEY must be a 32-byte base64 string");
  }
  const keyBuf = new Uint8Array(raw).buffer;
  return crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptCredentials(payload: Record<string, unknown>): Promise<string> {
  const key = await importAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(IV_LENGTH + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), IV_LENGTH);
  return `v1:${encodeBase64(combined)}`;
}

export async function decryptCredentials<T extends Record<string, unknown>>(
  ciphertext: string
): Promise<T> {
  const key = await importAesKey();
  const raw = ciphertext.startsWith("v1:") ? ciphertext.slice(3) : ciphertext;
  const combined = decodeBase64(raw);
  if (combined.byteLength <= IV_LENGTH) {
    throw new Error("Invalid encrypted credentials payload");
  }
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}

export async function verifyHmacSha256Hex(
  secret: string,
  payload: string | Uint8Array,
  expectedHex: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bodyBytes = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new Uint8Array(bodyBytes).buffer));
  const actualHex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const normalizedExpected = expectedHex.trim().toLowerCase();
  if (actualHex.length !== normalizedExpected.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ normalizedExpected.charCodeAt(i);
  }
  return diff === 0;
}
