import type { HazyClient } from "@repo/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { dashApiClient, dashQueryClient, setDashUnauthorizedHandler } from "@/lib/clients";
import { clearToken, getToken } from "@/lib/connect";
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

  const disconnect = useCallback(() => {
    clearToken();
    dashQueryClient.clear();
    notify();
  }, []);

  useEffect(() => {
    setDashUnauthorizedHandler(disconnect);
    return () => setDashUnauthorizedHandler(null);
  }, [disconnect]);

  if (token === undefined) return null;

  return (
    <QueryClientProvider client={dashQueryClient}>
      <DashContext.Provider
        value={{
          client: dashApiClient,
          t: strings(locale),
          locale,
          connected: token !== null,
          disconnect,
        }}
      >
        {children}
      </DashContext.Provider>
    </QueryClientProvider>
  );
}
