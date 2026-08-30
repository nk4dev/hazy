"use client";

import { useQuery } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";

export function useSearchQuery(query: string) {
  const client = useHazyClient();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: ({ signal }) => client.search(trimmed, undefined, signal),
    enabled: trimmed.length > 0,
  });
}
