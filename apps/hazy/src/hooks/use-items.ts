"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";

export function useItemsQuery(sort: "newest" | "oldest" = "newest") {
  const client = useHazyClient();
  return useInfiniteQuery({
    queryKey: ["items", sort],
    queryFn: ({ pageParam, signal }: { pageParam?: string; signal: AbortSignal }) =>
      client.items.list({ sort, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useSaveUrlMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => client.items.save(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}

export function useDeleteItemMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.items.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}
