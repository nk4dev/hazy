import type { AuthSessionData, AuthSessionUser } from "@repo/api-client/auth";
import { hazyQueryKeys } from "@repo/api-client/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { noteAuthClient, noteSessionQueryOptions } from "@/lib/clients";

type AuthContextValue = {
  session: AuthSessionData | null;
  user: AuthSessionUser | null;
  isPending: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  refreshSessionAfterAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const sessionQuery = useQuery(noteSessionQueryOptions);
  const session = sessionQuery.data ?? null;
  const user = session?.user ?? null;

  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId = previousUserIdRef.current;
    if (prevUserId && prevUserId !== currentUserId) {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== hazyQueryKeys.auth.all[0],
      });
    }
    previousUserIdRef.current = currentUserId;
  }, [user?.id, queryClient]);

  const signOut = useCallback(async () => {
    try {
      await noteAuthClient.signOut();
    } finally {
      queryClient.clear();
      queryClient.setQueryData(hazyQueryKeys.auth.session(), null);
      await router.invalidate();
      await router.navigate({ to: "/sign-in" as never, replace: true });
    }
  }, [queryClient, router]);

  const refreshSessionAfterAuth = useCallback(async () => {
    queryClient.clear();
    await queryClient.fetchQuery(noteSessionQueryOptions);
    await router.invalidate();
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isPending: sessionQuery.isPending,
      isSignedIn: Boolean(user),
      signOut,
      refreshSessionAfterAuth,
    }),
    [session, user, sessionQuery.isPending, signOut, refreshSessionAfterAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used inside <AuthProvider>");
  }
  return ctx;
}
