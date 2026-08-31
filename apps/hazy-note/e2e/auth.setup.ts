import { mkdirSync, writeFileSync } from "node:fs";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

const authFile = "e2e/.clerk/user.json";
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

/**
 * Signs in via Clerk's ticket flow — the backend mints a one-time sign-in
 * token for an existing user, so no password / OAuth is needed — and saves
 * the session to `authFile` for the `chromium` project.
 *
 * Requires (from apps/hazy-note/.env.local + your shell):
 *   CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 *   E2E_CLERK_USER_EMAIL  — email of an existing Clerk user to sign in as
 *
 * Without those, an empty storage state is written and the signed-in specs
 * skip themselves (see e2e/search.spec.ts) instead of failing the run.
 */
setup("authenticate", async ({ page }) => {
  mkdirSync("e2e/.clerk", { recursive: true });
  const email = process.env.E2E_CLERK_USER_EMAIL;

  if (!email || !process.env.CLERK_SECRET_KEY) {
    writeFileSync(authFile, EMPTY_STATE);
    setup.skip(true, "set E2E_CLERK_USER_EMAIL + CLERK_SECRET_KEY to run signed-in E2E specs");
    return;
  }

  await clerkSetup();
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("/notes");
  await page.waitForURL("**/notes");
  await page.context().storageState({ path: authFile });
});
