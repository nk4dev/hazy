import type { CollectionDetailDTO, CollectionSummaryDTO, SavedUrlDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/i18n";
import { hazyQueries } from "@/lib/clients";

export function useCollectionsQuery() {
  return useQuery(hazyQueries.collections());
}

export function useCollectionQuery(id: string) {
  return useQuery(hazyQueries.collection(id));
}

export function useCreateCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      client.collections.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all }),
  });
}

export function useAddToCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, savedUrlId }: { collectionId: string; savedUrlId: string }) =>
      client.collections.addItem(collectionId, savedUrlId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
      void queryClient.invalidateQueries({
        queryKey: hazyQueryKeys.collections.detail(variables.collectionId),
      });
      void queryClient.invalidateQueries({
        queryKey: hazyQueryKeys.items.detail(variables.savedUrlId),
      });
    },
  });
}

export function useSetItemCollectionsMutation(savedUrlId: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectionIds: string[]) =>
      client.items.setCollections(savedUrlId, collectionIds),
    onMutate: async (collectionIds) => {
      const key = hazyQueryKeys.items.detail(savedUrlId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedUrlDTO>(key);
      if (previous) {
        queryClient.setQueryData<SavedUrlDTO>(key, { ...previous, collectionIds });
      }
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.items.detail(savedUrlId), ctx.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SavedUrlDTO>(hazyQueryKeys.items.detail(savedUrlId), (prev) =>
        prev ? { ...prev, collectionIds: data.collectionIds } : prev
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
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
        hazyQueryKeys.collections.detail(id),
        (prev: CollectionDetailDTO | undefined) => (prev ? { ...prev, ...data } : prev)
      );
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
    },
  });
}

export function useRemoveFromCollectionMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, savedUrlId }: { collectionId: string; savedUrlId: string }) =>
      client.collections.removeItem(collectionId, savedUrlId),
    onMutate: async ({ collectionId, savedUrlId }) => {
      const key = hazyQueryKeys.collections.detail(collectionId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CollectionDetailDTO>(key);
      if (previous) {
        const nextItems = previous.items.filter((item) => item.id !== savedUrlId);
        queryClient.setQueryData<CollectionDetailDTO>(key, {
          ...previous,
          items: nextItems,
          itemCount: nextItems.length,
        });
      }
      return { previous };
    },
    onError: (_err, variables, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          hazyQueryKeys.collections.detail(variables.collectionId),
          ctx.previous
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
      void queryClient.invalidateQueries({
        queryKey: hazyQueryKeys.collections.detail(variables.collectionId),
      });
      void queryClient.invalidateQueries({
        queryKey: hazyQueryKeys.items.detail(variables.savedUrlId),
      });
    },
  });
}
