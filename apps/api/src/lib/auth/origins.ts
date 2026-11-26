import { env } from "@/env";

/**
 * First-party web origins allowed to hold Better Auth cookies and send
 * credentialed API requests. Connected apps (`hz_...`) are NOT included here;
 * they use Bearer tokens without credentials.
 */
export function getAllowedOrigins(): string[] {
  const raw = [
    env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3100",
    "http://localhost:3000",
    ...(env.CORS_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []),
  ];
  return [...new Set(raw.filter(Boolean))];
}

export function isAllowedOrigin(origin: string | undefined | null): origin is string {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}
