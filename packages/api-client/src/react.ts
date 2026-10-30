"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createHazyClient, type HazyClient } from "./client";

/**
 * The hazy API client wired to the current Clerk session. `NEXT_PUBLIC_API_URL`
 * points at `https://api.hz.nknighta.me` in production, `http://localhost:8787`
 * in dev. Memoised on `getToken` so react-query's `queryFn` identity is stable.
 */
function resolveDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "pctunnel.nknighta.me") {
      return "https://pctunnel-api.nknighta.me";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
}

export function useHazyClient(): HazyClient {
  const { getToken } = useAuth();
  return useMemo(
    () =>
      createHazyClient({
        baseUrl: resolveDefaultApiUrl(),
        getToken: () => getToken(),
      }),
    [getToken]
  );
}
