import { z } from "zod";

/**
 * Every secret is optional here on purpose: the app must boot with an empty
 * .env.local and show setup screens instead of crashing. Each subsystem
 * exposes its own isXConfigured() predicate below.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1).optional(),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL_ID: z.string().min(1).default("deepseek/deepseek-r1:free"),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_APP_NAME: z.string().min(1).default("Hazy"),
});

/**
 * process.env values are always strings — an unset-but-declared var in
 * .env.local (e.g. `CLERK_WEBHOOK_SIGNING_SECRET=` with nothing after `=`,
 * exactly what copying .env.example leaves for keys you haven't filled in
 * yet) comes through as `""`, not `undefined`. Left alone, that fails every
 * `.min(1)` check below even though the field is `.optional()`, which fails
 * the whole safeParse and falls back to defaults-only — silently dropping
 * every *other* real value (DATABASE_URL, Clerk keys, ...) too. Treat blank
 * strings as unset before validating.
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
    // Only truly malformed values (e.g. an invalid URL) land here, never
    // "missing" ones — those are all .optional(). Log and fall back to
    // defaults-only so a bad value in .env.local can't crash the server.
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

export function getMissingCoreServices(): CoreService[] {
  const missing: CoreService[] = [];
  if (!isDatabaseConfigured()) missing.push("database");
  if (!isClerkConfigured()) missing.push("clerk");
  return missing;
}
