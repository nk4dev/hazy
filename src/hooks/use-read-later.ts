"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedUrlDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export type ReadLaterBuckets = {
  totalCount: number;
  totalMinutes: number;
  todaysThreeMinutes: number;
  todaysThree: SavedUrlDTO[];
  fiveMinutes: SavedUrlDTO[];
  sitDown: SavedUrlDTO[];
};

export type ReadLaterStats = {
  days: { count: number; heightPct: number }[];
  readThisWeek: number;
  savedThisWeek: number;
};

export function useReadLaterQuery() {
  return useQuery({
    queryKey: ["read-later"],
    queryFn: async () => unwrap<ReadLaterBuckets>(await fetch("/api/v1/read-later")),
  });
}

export function useReadLaterStatsQuery() {
  return useQuery({
    queryKey: ["read-later", "stats"],
    queryFn: async () => unwrap<ReadLaterStats>(await fetch("/api/v1/read-later/stats")),
  });
}

export function useSetReadLaterStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      status,
      snoozedUntil,
    }: {
      itemId: string;
      status: "inbox" | "snoozed" | "read" | "archived";
      snoozedUntil?: string;
    }) =>
      unwrap(
        await fetch(`/api/v1/read-later/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, snoozedUntil }),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
  });
}
