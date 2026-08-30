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

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL_ID: z.string().min(1).default("google/gemma-4-26b-a4b-it:free"),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3100"),
  OPENROUTER_APP_NAME: z.string().min(1).default("Hazy"),
});

/**
 * An unset-but-declared var comes through as `""`, which fails every `.min(1)`
 * even on `.optional()` fields — failing the whole parse and silently dropping
 * every *other* real value. Treat blank strings as unset before validating.
 */
function sanitizeEmptyStrings(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const sanitized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    sanitized[key] = value === "" ? undefined : value;
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
export const isClerkConfigured = () =>
  Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
export const isClerkWebhookConfigured = () => Boolean(env.CLERK_WEBHOOK_SIGNING_SECRET);
export const isOpenRouterConfigured = () => Boolean(env.OPENROUTER_API_KEY);

export type CoreService = "database" | "clerk";
export type MissingService = CoreService | "openrouter";
