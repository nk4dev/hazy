const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

function readEnv(viteKey: string, nextKey: string, fallback: string): string {
  const value = viteEnv[viteKey] ?? viteEnv[nextKey];
  if (value === undefined || value === "") return fallback;
  return value;
}

export const env = {
  API_URL: readEnv("VITE_API_URL", "NEXT_PUBLIC_API_URL", "http://localhost:8787"),
  HAZY_URL: readEnv("VITE_HAZY_URL", "NEXT_PUBLIC_HAZY_URL", "http://localhost:3100"),
};
