import { expect, test } from '@playwright/test';
import { tab, tap, watchErrors } from './helpers';

test('視覺規範：分頁列與列表用 SVG 圖示，每月回顧卡用注意色', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  await tap(page, '先看看填好的樣子（示範資料）');
  await expect(page.locator('.tab-bar a svg')).toHaveCount(6);
  await expect(page.locator('.item-list .icon-badge svg').first()).toBeVisible();
  await expect(page.locator('.checkin-due')).toHaveCSS('background-color', 'rgb(253, 243, 220)');
  await expect(page.locator('.tab-bar')).not.toContainText(/[◎⇅▣♡⚑⚙]/);

  await tab(page, '計畫');
  await expect(page.locator('.goal-card .icon-badge').first()).toBeVisible();
  expect(errors).toEqual([]);
});
