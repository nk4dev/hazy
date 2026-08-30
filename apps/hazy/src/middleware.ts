import { clerkMiddleware } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// hazy is a pure frontend — the backend is `apps/api` (api.hz.nknighta.me).
// This layer just makes Clerk's `auth()` context available to the server-side
// redirect gate (`[locale]/(app)/layout.tsx`) and runs next-intl locale
// routing for every page.
export default clerkMiddleware(async (_auth, req) => {
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
