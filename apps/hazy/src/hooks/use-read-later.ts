"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";
import type { ReadLaterQueueDTO, ReadLaterStatsDTO } from "@repo/api-client";

export type ReadLaterBuckets = ReadLaterQueueDTO;
export type ReadLaterStats = ReadLaterStatsDTO;

export function useReadLaterQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["read-later"],
    queryFn: () => client.readLater.queue(),
  });
}

export function useReadLaterStatsQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["read-later", "stats"],
    queryFn: () => client.readLater.stats(),
  });
}

export function useSetReadLaterStatus() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      status,
      snoozedUntil,
    }: {
      itemId: string;
      status: "inbox" | "snoozed" | "read" | "archived";
      snoozedUntil?: string;
    }) => client.readLater.setStatus({ itemId, status, snoozedUntil }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}
