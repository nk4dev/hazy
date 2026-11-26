import type { ItemPatch, SavedUrlDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export function useItemQuery(id: string) {
  return useQuery(hazyQueries.item(id));
}

export function useUpdateItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ItemPatch) => client.items.update(id, patch),
    onMutate: async (patch) => {
      const key = hazyQueryKeys.items.detail(id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedUrlDTO>(key);
      if (previous) {
        queryClient.setQueryData<SavedUrlDTO>(key, {
          ...previous,
          ...patch,
          tags: patch.tags ?? previous.tags,
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.items.detail(id), ctx.previous);
      }
    },
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(hazyQueryKeys.items.detail(id), data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.detail(id) });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useRefetchItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.items.refetch(id),
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(hazyQueryKeys.items.detail(id), data);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
    },
  });
}

export function useDownloadItemImageMutation(id: string) {
  const client = useHazyClient();
  return useMutation({
    mutationFn: () => client.items.downloadImage(id),
  });
}

export function useSummarizeItemMutation(id: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.items.summarize(id),
    onSuccess: (data: SavedUrlDTO) => {
      queryClient.setQueryData(hazyQueryKeys.items.detail(id), data);
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.collections.all });
    },
  });
}
