import type { ReadLaterQueueDTO, ReadLaterStatsDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export type ReadLaterBuckets = ReadLaterQueueDTO;
export type ReadLaterStats = ReadLaterStatsDTO;

export function useReadLaterQuery() {
  return useQuery(hazyQueries.readLaterQueue());
}

export function useReadLaterStatsQuery() {
  return useQuery(hazyQueries.readLaterStats());
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
    onMutate: async ({ itemId, status }) => {
      if (status === "inbox") return {};
      const key = hazyQueryKeys.readLater.queue();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReadLaterQueueDTO>(key);
      if (previous) {
        const todaysThree = previous.todaysThree.filter((i) => i.id !== itemId);
        const fiveMinutes = previous.fiveMinutes.filter((i) => i.id !== itemId);
        const sitDown = previous.sitDown.filter((i) => i.id !== itemId);
        const allRemaining = [...todaysThree, ...fiveMinutes, ...sitDown];
        queryClient.setQueryData<ReadLaterQueueDTO>(key, {
          ...previous,
          todaysThree,
          fiveMinutes,
          sitDown,
          totalCount: allRemaining.length,
          todaysThreeMinutes: todaysThree.reduce(
            (sum, i) => sum + (i.estimatedReadMinutes ?? 0),
            0
          ),
          totalMinutes: allRemaining.reduce((sum, i) => sum + (i.estimatedReadMinutes ?? 0), 0),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.readLater.queue(), ctx.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.readLater.all });
      void queryClient.invalidateQueries({
        queryKey: hazyQueryKeys.items.detail(variables.itemId),
      });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.items.all });
    },
  });
}
