"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AskResponseDTO, AskThreadDTO, AskMessageDTO } from "@/types/api";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export function useAskThreadsQuery() {
  return useQuery({
    queryKey: ["ask", "threads"],
    queryFn: async () => unwrap<{ items: AskThreadDTO[] }>(await fetch("/api/v1/ask/threads")),
  });
}

export function useAskThreadQuery(threadId: string | null) {
  return useQuery({
    queryKey: ["ask", "threads", threadId],
    queryFn: async () =>
      unwrap<{ thread: AskThreadDTO; messages: AskMessageDTO[] }>(
        await fetch(`/api/v1/ask/threads/${threadId}`)
      ),
    enabled: Boolean(threadId),
  });
}

export function useAskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (question: string) =>
      unwrap<AskResponseDTO>(
        await fetch("/api/v1/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ask", "threads"] }),
  });
}

export function useAskFollowUpMutation(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (question: string) =>
      unwrap<AskResponseDTO>(
        await fetch(`/api/v1/ask/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ask", "threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["ask", "threads"] });
    },
  });
}
