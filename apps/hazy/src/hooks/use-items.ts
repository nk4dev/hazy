import type { PaginatedResponse, SavedUrlDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export function useItemsQuery(sort: "newest" | "oldest" = "newest") {
  return useInfiniteQuery(hazyQueries.itemsInfinite(sort));
}

export function useSaveUrlMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { url: string; collectionIds?: string[] }) =>
      typeof input === "string"
        ? client.items.save(input)
        : client.items.save(input.url, { collectionIds: input.collectionIds }),
    onSuccess: (item) => {
      queryClient.setQueryData(hazyQueryKeys.items.detail(item.id), item);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.readLater.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
    },
  });
}

export function useDeleteItemMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.items.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: hazyQueryKeys.items.all });
      const snapshots = queryClient.getQueriesData<InfiniteData<PaginatedResponse<SavedUrlDTO>>>({
        queryKey: hazyQueryKeys.items.all,
      });
      for (const [key, data] of snapshots) {
        if (!data || !("pages" in data)) continue;
        queryClient.setQueryData<InfiniteData<PaginatedResponse<SavedUrlDTO>>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== id),
          })),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: hazyQueryKeys.items.detail(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.readLater.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}
