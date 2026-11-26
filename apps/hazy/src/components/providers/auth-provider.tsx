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
import type { AppLocale } from "@/i18n/routing";
import { authClient, sessionQueryOptions } from "@/lib/clients";

type AuthContextValue = {
  session: AuthSessionData | null;
  user: AuthSessionUser | null;
  isPending: boolean;
  isSignedIn: boolean;
  signOut: (locale: AppLocale) => Promise<void>;
  refreshSessionAfterAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const sessionQuery = useQuery(sessionQueryOptions);
  const session = sessionQuery.data ?? null;
  const user = session?.user ?? null;

  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId = previousUserIdRef.current;
    if (prevUserId && prevUserId !== currentUserId) {
      // Wipe all user-scoped caches on sign-out or user switch so private data never leaks across sessions.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== hazyQueryKeys.auth.all[0],
      });
    }
    previousUserIdRef.current = currentUserId;
  }, [user?.id, queryClient]);

  const signOut = useCallback(
    async (locale: AppLocale) => {
      try {
        await authClient.signOut();
      } finally {
        queryClient.clear();
        queryClient.setQueryData(hazyQueryKeys.auth.session(), null);
        await router.invalidate();
        await router.navigate({ to: `/${locale}/sign-in` as never, replace: true });
      }
    },
    [queryClient, router]
  );

  const refreshSessionAfterAuth = useCallback(async () => {
    queryClient.clear();
    await queryClient.fetchQuery(sessionQueryOptions);
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
