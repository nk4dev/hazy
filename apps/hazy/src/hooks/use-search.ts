"use client";

import { useQuery } from "@tanstack/react-query";
import type { SavedUrlDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export function useSearchQuery(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: async () =>
      unwrap<{ query: string; items: SavedUrlDTO[] }>(
        await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`)
      ),
    enabled: trimmed.length > 0,
  });
}
