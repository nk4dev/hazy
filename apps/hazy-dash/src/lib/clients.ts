import { createHazyClient } from "@repo/api-client";
import { createAppQueryClient, createHazyQueryOptions } from "@repo/api-client/query";
import { clearToken, getToken } from "./connect";
import { API_URL } from "./env";

let onUnauthorizedHandler: (() => void) | null = null;

export function setDashUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorizedHandler = handler;
}

export const dashApiClient = createHazyClient({
  baseUrl: API_URL,
  getToken: async () => getToken(),
  credentials: "omit",
});

export const dashQueries = createHazyQueryOptions(dashApiClient);

export const dashQueryClient = createAppQueryClient({
  refetchOnWindowFocus: true,
  onUnauthorized: () => {
    if (onUnauthorizedHandler) {
      onUnauthorizedHandler();
      return;
    }
    clearToken();
    dashQueryClient.clear();
  },
});
