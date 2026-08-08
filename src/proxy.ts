import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Route protection happens per-resource (see src/lib/auth/current-user.ts),
// not here — Clerk's own guidance is to keep this layer thin and check auth
// as close to the data as possible. This just makes Clerk's auth() context
// available to every request. /api/v1/** is a plain JSON API consumed by
// both the web app and (later) Flutter, so it must never be locale-prefixed
// or redirected by next-intl — only page routes go through intlMiddleware.
export default clerkMiddleware(async (_auth, req) => {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
