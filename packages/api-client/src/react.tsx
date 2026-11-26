import { createContext, type ReactNode, useContext, useMemo } from "react";
import { createHazyClient, type HazyClient } from "./client";

const HazyClientContext = createContext<HazyClient | null>(null);

type HazyClientProviderProps =
  | {
      client: HazyClient;
      children: ReactNode;
    }
  | {
      baseUrl: string;
      getToken?: () => Promise<string | null>;
      credentials?: RequestCredentials;
      children: ReactNode;
    };

export function HazyClientProvider(props: HazyClientProviderProps) {
  const prebuilt = "client" in props ? props.client : null;
  const baseUrl = "baseUrl" in props ? props.baseUrl : "";
  const getToken = "getToken" in props ? props.getToken : undefined;
  const credentials = "credentials" in props ? props.credentials : undefined;

  const client = useMemo(
    () =>
      prebuilt ??
      createHazyClient({
        baseUrl,
        getToken,
        credentials,
      }),
    [prebuilt, baseUrl, getToken, credentials]
  );

  return <HazyClientContext.Provider value={client}>{props.children}</HazyClientContext.Provider>;
}

export function useHazyClient(): HazyClient {
  const client = useContext(HazyClientContext);
  if (!client) {
    throw new Error("useHazyClient must be used inside <HazyClientProvider>");
  }
  return client;
}
