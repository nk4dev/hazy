import type { MeDTO, UserPreferencesDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export type Preferences = UserPreferencesDTO;
export type Me = MeDTO;

export function useMeQuery() {
  return useQuery(hazyQueries.me());
}

export function useUpdatePreferencesMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Preferences>) => client.me.updatePreferences(patch),
    onMutate: async (patch) => {
      const key = hazyQueryKeys.me();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MeDTO>(key);
      if (previous) {
        queryClient.setQueryData<MeDTO>(key, {
          ...previous,
          preferences: { ...previous.preferences, ...patch },
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.me(), ctx.previous);
      }
    },
    onSuccess: (prefs) => {
      queryClient.setQueryData<MeDTO>(hazyQueryKeys.me(), (prev) =>
        prev ? { ...prev, preferences: prefs } : prev
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: hazyQueryKeys.me() }),
  });
}
