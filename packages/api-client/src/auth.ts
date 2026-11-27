import { createAuthClient } from "better-auth/client";

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export type AuthSessionData = {
  user: AuthSessionUser;
  session: {
    id: string;
    expiresAt: string | Date;
  };
};

export function createHazyAuthClient(baseUrl: string) {
  return createAuthClient({
    baseURL: baseUrl,
    fetchOptions: {
      credentials: "include",
    },
  });
}

export type HazyAuthClient = ReturnType<typeof createHazyAuthClient>;

/** Reads the active Better Auth cookie session; returns `null` when signed out or unreachable. */
export async function fetchAuthSession(
  authClient: HazyAuthClient
): Promise<AuthSessionData | null> {
  try {
    const res = await authClient.getSession();
    const data = res?.data;
    if (!data?.user || !data?.session) return null;
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        image: data.user.image ?? null,
      },
      session: {
        id: data.session.id,
        expiresAt: data.session.expiresAt,
      },
    };
  } catch {
    return null;
  }
}
