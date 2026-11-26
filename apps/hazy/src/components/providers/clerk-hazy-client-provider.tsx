import { useAuth } from "@clerk/clerk-react";
import { HazyClientProvider } from "@repo/api-client/react";
import type { ReactNode } from "react";
import { env } from "@/lib/env";

export function ClerkHazyClientProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  return (
    <HazyClientProvider baseUrl={env.API_URL} getToken={() => getToken()}>
      {children}
    </HazyClientProvider>
  );
}
