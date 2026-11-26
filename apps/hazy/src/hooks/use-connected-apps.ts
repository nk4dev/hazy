import type { ConnectAuthorizeInput, ConnectedAppDTO } from "@repo/api-client";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export function useConnectedAppsQuery() {
  return useQuery(hazyQueries.connectedApps());
}

export function useRevokeConnectedAppMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.connect.revoke(id),
    onMutate: async (id) => {
      const key = hazyQueryKeys.connect.apps();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ items: ConnectedAppDTO[] }>(key);
      if (previous) {
        queryClient.setQueryData<{ items: ConnectedAppDTO[] }>(key, {
          items: previous.items.filter((app) => app.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(hazyQueryKeys.connect.apps(), ctx.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: hazyQueryKeys.connect.apps() }),
  });
}

export function useAuthorizeConnectMutation() {
  const client = useHazyClient();
  return useMutation({
    mutationFn: (input: ConnectAuthorizeInput) => client.connect.authorize(input),
  });
}
