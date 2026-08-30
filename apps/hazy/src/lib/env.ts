import { z } from "zod";

/**
 * hazy is a pure frontend now — the backend lives in `apps/api`
 * (`https://api.hz.nknighta.me`). This app only needs its own URL, the Clerk
 * keys (for `<ClerkProvider>` + the server-side redirect gate), and the API
 * base URL. Every secret stays optional so the app boots with an empty
 * `.env.local` and shows the setup screen.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3100"),
  // The hazy-note app (separate deploy, same database). Used for the
  // "Open in Note" deep link on the item page.
  NEXT_PUBLIC_HAZY_NOTE_URL: z.string().url().default("http://localhost:3000"),
  // The hazy API service (apps/api).
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8787"),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
});

/** Blank strings (an unfilled `KEY=` line) come through as `""` — treat as unset. */
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

export const isClerkConfigured = () =>
  Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);

export type CoreService = "clerk";

export function getMissingCoreServices(): CoreService[] {
  return isClerkConfigured() ? [] : ["clerk"];
}
