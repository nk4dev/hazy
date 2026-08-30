"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createHazyClient, type HazyClient } from "./client";

/**
 * The hazy API client wired to the current Clerk session. `NEXT_PUBLIC_API_URL`
 * points at `https://api.hz.nknighta.me` in production, `http://localhost:8787`
 * in dev. Memoised on `getToken` so react-query's `queryFn` identity is stable.
 */
export function useHazyClient(): HazyClient {
  const { getToken } = useAuth();
  return useMemo(
    () =>
      createHazyClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
        getToken: () => getToken(),
      }),
    [getToken]
  );
}
