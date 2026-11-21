import { defineConfig, devices } from '@playwright/test';

// 瀏覽器端對端測試：以手機尺寸跑建置後的網站。
// - v1（預設建置，只有淨值、投資、設定）：npm run build，再 npm run test:e2e
// - 全功能建置（VITE_FEATURES=all）：npm run build:all，再 npm run test:e2e:all
// 測試隱藏功能的測試在名稱加上 @full，只在全功能建置跑；其他測試只在 v1 建置跑。
const full = process.env.E2E_BUILD === 'full';
const port = full ? 4174 : 4173;
const baseURL = `http://localhost:${port}/`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  outputDir: full ? 'test-results-full' : 'test-results',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: full ? 'playwright-report-full' : 'playwright-report' }]] : 'list',
  use: {
    baseURL,
    ...devices['Pixel 7'],
    locale: 'zh-TW',
    trace: 'retain-on-failure',
  },
  projects: full
    ? [{ name: 'mobile-chromium-full', grep: /@full/ }]
    : [{ name: 'mobile-chromium', grepInvert: /@full/ }],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort${full ? ' --outDir dist-full' : ''}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
