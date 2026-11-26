"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/i18n";
import { useHazyClient } from "@repo/api-client/react";
import type { CollectionDetailDTO, CollectionSummaryDTO, SavedUrlDTO } from "@repo/api-client";

export function useCollectionsQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["collections"],
    queryFn: () => client.collections.list(),
  });
}

export function useCollectionQuery(id: string) {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["collections", id],
    queryFn: ({ signal }) => client.collections.get(id, signal),
    enabled: Boolean(id),
  });
}

export function useCreateCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      client.collections.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useAddToCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, savedUrlId }: { collectionId: string; savedUrlId: string }) =>
      client.collections.addItem(collectionId, savedUrlId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.savedUrlId] });
    },
  });
}

export function useSetItemCollectionsMutation(savedUrlId: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectionIds: string[]) =>
      client.items.setCollections(savedUrlId, collectionIds),
    onSuccess: (data) => {
      queryClient.setQueryData<SavedUrlDTO>(["item", savedUrlId], (prev) =>
        prev ? { ...prev, collectionIds: data.collectionIds } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useSummarizeCollectionMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: () => client.collections.summarize(id, locale as "en" | "ja"),
    onSuccess: (data: CollectionSummaryDTO) => {
      queryClient.setQueryData(
        ["collections", id],
        (prev: CollectionDetailDTO | undefined) => (prev ? { ...prev, ...data } : prev)
      );
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useRemoveFromCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, savedUrlId }: { collectionId: string; savedUrlId: string }) =>
      client.collections.removeItem(collectionId, savedUrlId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.savedUrlId] });
    },
  });
}
