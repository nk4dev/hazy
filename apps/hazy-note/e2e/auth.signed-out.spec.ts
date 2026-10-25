import { expect, test } from "@playwright/test";

// No storageState — the `signed-out` project runs these as an anonymous visitor.

test("protected routes redirect to sign-in", async ({ page }) => {
  await page.goto("/notes");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/search is protected too", async ({ page }) => {
  await page.goto("/search");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the sign-in page renders the Clerk widget", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
