"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedUrlDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export function useItemQuery(id: string) {
  return useQuery({
    queryKey: ["item", id],
    queryFn: async () => unwrap<SavedUrlDTO>(await fetch(`/api/v1/items/${id}`)),
  });
}

type ItemPatch = { title?: string | null; summary?: string | null; tags?: string[] };

export function useUpdateItemMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ItemPatch) =>
      unwrap<SavedUrlDTO>(
        await fetch(`/api/v1/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useRefetchItemMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<SavedUrlDTO>(await fetch(`/api/v1/items/${id}/refetch`, { method: "POST" })),
    onSuccess: (data) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useSummarizeItemMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<SavedUrlDTO>(await fetch(`/api/v1/items/${id}/summarize`, { method: "POST" })),
    onSuccess: (data) => {
      queryClient.setQueryData(["item", id], data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
