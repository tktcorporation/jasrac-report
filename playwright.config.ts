import { defineConfig } from "@playwright/test";

/**
 * Playwright e2e テスト設定。
 * dev サーバーを自動起動し、実際のブラウザで画面操作を検証する。
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
