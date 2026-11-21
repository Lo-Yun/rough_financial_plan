import { expect, test } from '@playwright/test';
import { completeOnboarding, openWelcome, tab, tap, watchErrors } from './helpers';

test('投資儀表板：摘要在最上面，目標配置在設定子頁', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { investment: true });
  await tab(page, '投資');

  const summary = page.locator('.portfolio-summary');
  await expect(summary).toContainText('投資組合總值');
  await expect(summary).toContainText('風險程度');
  await expect(summary.locator('.alloc-bar')).toBeVisible();
  // 還沒設定目標：摘要提示去設定，主頁不再直接放範本按鈕
  await expect(page.getByRole('button', { name: '穩健' })).toHaveCount(0);
  await summary.getByRole('link', { name: /設定目標配置/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: '投資組合設定' })).toBeVisible();
  await tap(page, '積極');
  const cash = page.getByRole('checkbox', { name: /包含現金與存款/ });
  await cash.click();
  await expect(cash).toBeChecked();
  await page.getByRole('button', { name: /上一步/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: '投資組合' })).toBeVisible();
  await expect(summary).toContainText(/偏離目標|目標的 ±/);
  await expect(page.locator('.link-card')).toContainText('目標配置：積極・包含現金');
  expect(errors).toEqual([]);
});

test('投資儀表板：示範資料的偏離提示排在帳戶前面', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await tap(page, '先看看填好的樣子（示範資料）');
  await tab(page, '投資');
  await expect(page.locator('.portfolio-summary')).toContainText('偏離目標');
  const headings = await page.locator('.page h2').allTextContents();
  expect(headings.indexOf('再平衡提示')).toBeLessThan(headings.indexOf('投資帳戶'));
  expect(headings.indexOf('投資帳戶')).toBeLessThan(headings.indexOf('資產配置'));
  expect(errors).toEqual([]);
});
