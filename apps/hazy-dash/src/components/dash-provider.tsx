"use client";

import { ApiClientError, createHazyClient, type HazyClient } from "@repo/api-client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { clearToken, getToken } from "@/lib/connect";
import { API_URL } from "@/lib/env";
import { detectLocale, type Strings, strings } from "@/lib/i18n";

type Dash = {
  client: HazyClient;
  t: Strings;
  locale: "en" | "ja";
  connected: boolean;
  disconnect: () => void;
};

const DashContext = createContext<Dash | null>(null);

export function useDash(): Dash {
  const dash = useContext(DashContext);
  if (!dash) throw new Error("useDash outside DashProvider");
  return dash;
}

// The token lives in localStorage; re-read it whenever we change it here.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => {
  for (const fn of listeners) fn();
};

export function DashProvider({ children }: { children: React.ReactNode }) {
  // `undefined` on the server: render nothing until we can read storage.
  const token = useSyncExternalStore(subscribe, getToken, () => undefined);
  const locale = useSyncExternalStore(subscribe, detectLocale, () => "ja" as const);

  const [client] = useState(() =>
    createHazyClient({ baseUrl: API_URL, getToken: async () => getToken() })
  );

  const disconnect = () => {
    clearToken();
    queryClient.clear();
    notify();
  };

  // A 401 means the token was revoked in hazy's settings — back to Connect.
  const onError = (error: unknown) => {
    if (error instanceof ApiClientError && error.status === 401) disconnect();
  };
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError }),
        mutationCache: new MutationCache({ onError }),
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
      })
  );

  if (token === undefined) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <DashContext.Provider
        value={{ client, t: strings(locale), locale, connected: token !== null, disconnect }}
      >
        {children}
      </DashContext.Provider>
    </QueryClientProvider>
  );
}
