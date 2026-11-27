import type { AppUser } from "@/lib/auth/current-user";

export type AppProfile = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Hono generics for the authed part of the API — `c.get("user")` is the
 * resolved internal `users` row, set by `authMiddleware`; `authVia` says how
 * the request authenticated (a connected app's `hz_…` token can't manage
 * connections); `profile` is set by `profileMiddleware`. */
export type AppEnv = {
  Variables: {
    user: AppUser;
    authVia: "better_auth" | "clerk" | "api_token";
    profile: AppProfile;
    apiTokenProfileId?: string;
  };
};
