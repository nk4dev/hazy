const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

/** The hazy web app — hosts the "Connect with Hazy" approval page and item pages. */
export const HAZY_URL =
  viteEnv.VITE_HAZY_URL ?? viteEnv.NEXT_PUBLIC_HAZY_URL ?? "https://hz.nknighta.me";
/** apps/api — the `/v1/**` JSON API this dashboard reads with its `hz_…` token. */
export const API_URL =
  viteEnv.VITE_API_URL ?? viteEnv.NEXT_PUBLIC_API_URL ?? "https://api.hz.nknighta.me";
