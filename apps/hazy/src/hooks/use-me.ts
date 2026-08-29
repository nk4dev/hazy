"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Preferences = {
  interfaceLocale: "en" | "ja";
  answerLanguageMode: "interface" | "source";
  notifyReadLaterDigest: boolean;
  notifyWeeklyStats: boolean;
};

type Me = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: Preferences;
};

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function unwrap<T>(res: Response): Promise<T> {
  const body: ApiEnvelope<T> = await res.json();
  if ("error" in body) throw new Error(body.error.message);
  return body.data;
}

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => unwrap<Me>(await fetch("/api/v1/me")),
  });
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Preferences>) =>
      unwrap(
        await fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}
