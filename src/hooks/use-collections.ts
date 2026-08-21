"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CollectionDTO, SavedUrlDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export function useCollectionsQuery() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => unwrap<{ items: CollectionDTO[] }>(await fetch("/api/v1/collections")),
  });
}

export function useCollectionQuery(id: string) {
  return useQuery({
    queryKey: ["collections", id],
    queryFn: async () =>
      unwrap<CollectionDTO & { items: SavedUrlDTO[] }>(await fetch(`/api/v1/collections/${id}`)),
    enabled: Boolean(id),
  });
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      unwrap<CollectionDTO>(
        await fetch("/api/v1/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useAddToCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      savedUrlId,
    }: {
      collectionId: string;
      savedUrlId: string;
    }) =>
      unwrap(
        await fetch(`/api/v1/collections/${collectionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedUrlId }),
        })
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
    },
  });
}

export function useRemoveFromCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      savedUrlId,
    }: {
      collectionId: string;
      savedUrlId: string;
    }) =>
      unwrap(
        await fetch(`/api/v1/collections/${collectionId}/items/${savedUrlId}`, {
          method: "DELETE",
        })
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId] });
    },
  });
}
