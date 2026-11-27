import { z } from "zod";

/**
 * Moved from `apps/hazy/src/lib/env.ts`. Every secret is optional on purpose:
 * the Worker must boot with nothing configured and return 503s (not crash) so
 * a half-configured deploy is debuggable. Each subsystem has its own
 * `isXConfigured()` predicate.
 *
 * On Workers (`nodejs_compat` + a recent compat date) `process.env` is
 * populated from `wrangler.jsonc` `vars` and `wrangler secret`. In local dev
 * `tsx --env-file=.dev.vars` populates it.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3100"),

  /** Comma-separated extra CORS origins. localhost:3100 is always allowed. */
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
  BETTER_AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL_ID: z.string().min(1).default("google/gemma-4-26b-a4b-it:free"),
  OPENROUTER_FALLBACK_MODELS: z
    .string()
    .default("meta-llama/llama-3.3-70b-instruct:free,openrouter/free"),
  OPENROUTER_NOTE_MODEL_ID: z.string().min(1).default("mistralai/mistral-small-2603"),
  OPENROUTER_NOTE_FALLBACK_MODELS: z
    .string()
    .default("google/gemma-4-26b-a4b-it:free,openrouter/free"),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(3000).max(60000).default(20000),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3100"),
  OPENROUTER_APP_NAME: z.string().min(1).default("Hazy"),

  BLOG_CREDENTIALS_KEY: z.string().min(1).optional(),
});

/** Deduplicate and preserve priority order for a primary model + comma-separated fallbacks. */
export function parseModelList(primary: string, fallbacksCsv?: string): string[] {
  const raw = [
    primary,
    ...(fallbacksCsv ? fallbacksCsv.split(",") : []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * An unset-but-declared var comes through as `""`, which fails every `.min(1)`
 * even on `.optional()` fields — failing the whole parse and silently dropping
 * every *other* real value. Treat blank strings as unset before validating.
 */
function sanitizeEmptyStrings(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const sanitized: Record<string, string | undefined> = {};
  let sawUnexpandedOpRef = false;
  for (const [key, value] of Object.entries(raw)) {
    if (value === "") {
      sanitized[key] = undefined;
    } else if (typeof value === "string" && value.startsWith("op://")) {
      sanitized[key] = undefined;
      sawUnexpandedOpRef = true;
    } else {
      sanitized[key] = value;
    }
  }
  if (sawUnexpandedOpRef) {
    console.warn(
      'Detected unexpanded 1Password "op://" references in env; run via `op run --env-file=".env.op" -- bun run dev`.'
    );
  }
  return sanitized;
}

function loadEnv() {
  const parsed = envSchema.safeParse(sanitizeEmptyStrings(process.env));
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    return envSchema.parse({});
  }
  return parsed.data;
}

export const env = loadEnv();

export const isDatabaseConfigured = () => Boolean(env.DATABASE_URL);
export const isBetterAuthConfigured = () => Boolean(env.BETTER_AUTH_SECRET && env.DATABASE_URL);
export const isGithubOAuthConfigured = () =>
  Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
export const isClerkConfigured = () =>
  Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
export const isClerkWebhookConfigured = () => Boolean(env.CLERK_WEBHOOK_SIGNING_SECRET);
export const isOpenRouterConfigured = () => Boolean(env.OPENROUTER_API_KEY);
export const isBlogCredentialsConfigured = () => Boolean(env.BLOG_CREDENTIALS_KEY);

export type CoreService = "database" | "clerk" | "better_auth";
export type MissingService = CoreService | "openrouter" | "blog_credentials";
