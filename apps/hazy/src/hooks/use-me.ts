"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHazyClient } from "@repo/api-client/react";
import type { MeDTO, UserPreferencesDTO } from "@repo/api-client";

export type Preferences = UserPreferencesDTO;
export type Me = MeDTO;

export function useMeQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => client.me.get(),
  });
}

export function useUpdatePreferencesMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Preferences>) => client.me.updatePreferences(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}
