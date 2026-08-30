"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";
import type { ItemPatch, SavedUrlDTO } from "@repo/api-client";

export function useItemQuery(id: string) {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["item", id],
    queryFn: ({ signal }) => client.items.get(id, signal),
  });
}

export function useUpdateItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ItemPatch) => client.items.update(id, patch),
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useRefetchItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.items.refetch(id),
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useSummarizeItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.items.summarize(id),
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
