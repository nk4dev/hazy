import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { getDb } from "@/db";
import { authAccount, authPasskey, authSession, authUser, authVerification } from "@/db/schema";
import {
  env,
  getPasskeyRpId,
  isBetterAuthConfigured,
  isGithubOAuthConfigured,
} from "@/env";
import { getAllowedOrigins } from "@/lib/auth/origins";

export type BetterAuthSessionResult = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};

/**
 * Single-user access gate. Fail-closed: if `ADMIN_EMAIL` is unset or does not
 * match (case-insensitive, trimmed), sign-ups and session resolution are denied.
 */
export function isAllowedAdminEmail(
  email: string | null | undefined,
  adminEmail: string | undefined = env.ADMIN_EMAIL
): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}

function createAuthInstance() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
        passkey: authPasskey,
      },
    }),
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: () => getAllowedOrigins(),
    emailAndPassword: {
      enabled: false,
    },
    ...(isGithubOAuthConfigured() && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          socialProviders: {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          },
        }
      : {}),
    plugins: [
      passkey({
        rpID: getPasskeyRpId(),
        rpName: env.PASSKEY_RP_NAME,
        origin: getAllowedOrigins(),
      }),
    ],
    advanced: {
      crossSubDomainCookies: env.BETTER_AUTH_COOKIE_DOMAIN
        ? { enabled: true, domain: env.BETTER_AUTH_COOKIE_DOMAIN }
        : { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.BETTER_AUTH_URL.startsWith("https://"),
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isAllowedAdminEmail(user.email)) {
              throw new APIError("FORBIDDEN", {
                message: "Sign-up is restricted to the administrator account.",
              });
            }
          },
        },
      },
    },
  });
}

type BetterAuthInstance = ReturnType<typeof createAuthInstance>;

let cachedAuth: BetterAuthInstance | null = null;

/** Lazily instantiated Better Auth handler so keyless builds/tests never fail on import. */
export function getAuth(): BetterAuthInstance {
  if (!cachedAuth) {
    cachedAuth = createAuthInstance();
  }
  return cachedAuth;
}

export function __resetAuthForTest() {
  cachedAuth = null;
}

export async function getBetterAuthSession(
  headers: Headers
): Promise<BetterAuthSessionResult | null> {
  if (!isBetterAuthConfigured()) return null;
  try {
    const result = await getAuth().api.getSession({ headers });
    if (!result?.user) return null;
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image ?? null,
      },
    };
  } catch {
    return null;
  }
}
