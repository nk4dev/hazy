import { createContext, type ReactNode, useContext, useMemo } from "react";
import { createHazyClient, type HazyClient } from "./client";

const HazyClientContext = createContext<HazyClient | null>(null);

export function HazyClientProvider({
  baseUrl,
  getToken,
  children,
}: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  children: ReactNode;
}) {
  const client = useMemo(
    () =>
      createHazyClient({
        baseUrl,
        getToken,
      }),
    [baseUrl, getToken]
  );

  return <HazyClientContext.Provider value={client}>{children}</HazyClientContext.Provider>;
}

export function useHazyClient(): HazyClient {
  const client = useContext(HazyClientContext);
  if (!client) {
    throw new Error("useHazyClient must be used inside <HazyClientProvider>");
  }
  return client;
}
