"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";

export type AskInput = { question: string; collectionIds?: string[] };

export function useAskThreadsQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["ask", "threads"],
    queryFn: () => client.ask.threads(),
  });
}

export function useAskThreadQuery(threadId: string | null) {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["ask", "threads", threadId],
    queryFn: ({ signal }) => client.ask.thread(threadId as string, signal),
    enabled: Boolean(threadId),
  });
}

export function useAskMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AskInput) => client.ask.ask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ask", "threads"] }),
  });
}

export function useDeleteAskThreadMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => client.ask.deleteThread(threadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ask", "threads"] }),
  });
}

export function useAskFollowUpMutation(threadId: string) {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AskInput) => client.ask.followUp(threadId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ask", "threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["ask", "threads"] });
    },
  });
}
