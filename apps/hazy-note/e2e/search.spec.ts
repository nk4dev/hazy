import { expect, test } from "@playwright/test";

// Uses the `chromium` project's storageState (e2e/.clerk/user.json). When auth
// setup was skipped that state is empty, so /search redirects to sign-in and
// every spec here skips itself rather than failing.
/** Click one of the four mode tabs in the segmented control. */
const pickMode = (page: import("@playwright/test").Page, label: string) =>
  page.locator("main label.seg-opt", { hasText: label }).click();

test.beforeEach(async ({ page }) => {
  await page.goto("/search");
  if (/\/sign-in/.test(page.url())) test.skip(true, "not signed in (see e2e/auth.setup.ts)");
  await expect(page.getByRole("heading", { name: "ノートと出典をまとめて探す" })).toBeVisible();
});

test("search is in the sidebar nav", async ({ page }) => {
  await expect(page.getByRole("link", { name: "検索" })).toBeVisible();
});

test("keyword search filters as you type", async ({ page }) => {
  const box = page.getByPlaceholder("キーワード検索…");
  await box.fill("a");
  // Whatever the library holds, a single common letter should hit something.
  await expect(page.locator("main ul > *").first()).toBeVisible({ timeout: 10_000 });
});

test("tag mode shows a tag cloud and filters on click", async ({ page }) => {
  await pickMode(page, "タグ");
  const firstTag = page.locator("main button", { hasText: /·\s*\d+$/ }).first();
  await expect(firstTag).toBeVisible();
  await firstTag.click();
  await expect(page.getByPlaceholder("タグ名（例: typescript）")).not.toHaveValue("");
});

test("AI mode explains the on-device model", async ({ page }) => {
  await pickMode(page, "AI検索");
  await expect(page.getByText(/@ternlight\/base/)).toBeVisible();
  await expect(page.getByPlaceholder(/意味で検索/)).toBeVisible();
});

test("chat mode shows the grounding note and a submit button", async ({ page }) => {
  await pickMode(page, "チャット");
  await expect(page.getByPlaceholder("自分の記録に質問する…")).toBeVisible();
  await expect(page.getByText(/保存したノートと記事だけを資料に/)).toBeVisible();
  await expect(page.getByRole("button", { name: "質問" })).toBeVisible();
});

// Opt-in: hits OpenRouter. Run with E2E_CHAT=1.
test("chat search returns a grounded answer", async ({ page }) => {
  test.skip(!process.env.E2E_CHAT, "set E2E_CHAT=1 to exercise the live chat endpoint");
  await pickMode(page, "チャット");
  await page.getByPlaceholder("自分の記録に質問する…").fill("自分は何をメモした？");
  await page.getByRole("button", { name: "質問" }).click();
  await expect(page.locator("main .whitespace-pre-wrap")).toHaveCount(2, { timeout: 40_000 });
});
