const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

function readEnv(viteKey: string, nextKey: string, fallback?: string): string | undefined {
  const value = viteEnv[viteKey] ?? viteEnv[nextKey];
  if (value === undefined || value === "") return fallback;
  return value;
}

export const env = {
  APP_URL: readEnv("VITE_APP_URL", "NEXT_PUBLIC_APP_URL", "http://localhost:3100") as string,
  HAZY_NOTE_URL: readEnv(
    "VITE_HAZY_NOTE_URL",
    "NEXT_PUBLIC_HAZY_NOTE_URL",
    "http://localhost:3000"
  ) as string,
  API_URL: readEnv("VITE_API_URL", "NEXT_PUBLIC_API_URL", "http://localhost:8787") as string,
  CLERK_PUBLISHABLE_KEY: readEnv(
    "VITE_CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  ),
};

export const isClerkConfigured = () => Boolean(env.CLERK_PUBLISHABLE_KEY);

export type CoreService = "clerk";

export function getMissingCoreServices(): CoreService[] {
  return isClerkConfigured() ? [] : ["clerk"];
}
