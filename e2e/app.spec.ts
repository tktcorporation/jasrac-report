import { expect, test } from "@playwright/test";

test.describe("トップページ", () => {
  test("ヘッダーが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "JASRAC情報検索・申請ツール" })).toBeVisible();
  });

  test("曲情報入力タブがデフォルトで選択されている", async ({ page }) => {
    await page.goto("/");
    const inputTab = page.getByRole("button", { name: "曲情報入力" });
    await expect(inputTab).toBeVisible();
    await expect(inputTab).toHaveClass(/text-blue-600/);
  });

  test("検索結果タブに切り替えできる", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const resultsTab = page.getByRole("button", { name: "検索結果" });
    await resultsTab.click();
    // タブ切り替え後、曲情報入力フォームが非表示になることを確認
    await expect(page.getByLabel("曲名")).not.toBeVisible();
  });

  test("曲名を入力できる", async ({ page }) => {
    await page.goto("/");
    const titleInput = page.getByLabel("曲名");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Butter-Fly");
    await expect(titleInput).toHaveValue("Butter-Fly");
  });
});
