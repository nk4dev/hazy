"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginatedResponse, SavedUrlDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string; details?: unknown } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) {
    throw new Error(body.error.message);
  }
  return body.data;
}

export function useItemsQuery(sort: "newest" | "oldest" = "newest") {
  return useInfiniteQuery({
    queryKey: ["items", sort],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params = new URLSearchParams({ sort });
      if (pageParam) params.set("cursor", pageParam);
      const res = await fetch(`/api/v1/items?${params.toString()}`);
      return unwrap<PaginatedResponse<SavedUrlDTO>>(res);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useSaveUrlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/v1/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      return unwrap<SavedUrlDTO>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/items/${id}`, { method: "DELETE" });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}
