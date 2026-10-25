"use client";

import type { ConnectAuthorizeInput } from "@repo/api-client";
import { useHazyClient } from "@repo/api-client/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useConnectedAppsQuery() {
  const client = useHazyClient();
  return useQuery({
    queryKey: ["connected-apps"],
    queryFn: () => client.connect.apps(),
  });
}

export function useRevokeConnectedAppMutation() {
  const client = useHazyClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.connect.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connected-apps"] }),
  });
}

export function useAuthorizeConnectMutation() {
  const client = useHazyClient();
  return useMutation({
    mutationFn: (input: ConnectAuthorizeInput) => client.connect.authorize(input),
  });
}
