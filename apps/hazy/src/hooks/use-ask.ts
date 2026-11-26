import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export type AskInput = { question: string; collectionIds?: string[] };

export function useAskThreadsQuery() {
  return useQuery(hazyQueries.askThreads());
}

export function useAskThreadQuery(threadId: string | null) {
  return useQuery(hazyQueries.askThread(threadId));
}

export function useAskMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AskInput) => client.ask.ask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hazyQueryKeys.ask.threads() }),
  });
}

export function useDeleteAskThreadMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => client.ask.deleteThread(threadId),
    onSuccess: (_data, threadId) => {
      queryClient.removeQueries({ queryKey: hazyQueryKeys.ask.thread(threadId) });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.ask.threads() });
    },
  });
}

export function useAskFollowUpMutation(threadId: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AskInput) => client.ask.followUp(threadId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.ask.thread(threadId) });
      void queryClient.invalidateQueries({ queryKey: hazyQueryKeys.ask.threads() });
    },
  });
}
