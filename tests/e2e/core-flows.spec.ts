import { expect, test } from '@playwright/test';
import { amount, completeOnboarding, tab, tap, watchErrors } from './helpers';

test('快速估算後，每個分頁都能正常開啟', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { investment: true });
  await expect(page.locator('.card.hero')).toContainText('精確度');

  for (const [name, heading] of [
    ['收支', '收支'],
    ['投資', '投資組合'],
    ['健檢', '財務健檢'],
    ['計畫', '理財計畫'],
    ['設定', '設定'],
  ] as const) {
    await tab(page, name);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.goto('./#/history');
  await expect(page.getByRole('heading', { level: 1, name: '淨值歷史' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('新增支出、建立緊急預備金計畫，重新整理後資料仍在', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);
  await tab(page, '收支');
  await page.getByRole('link', { name: '+ 新增支出' }).click();
  await tap(page, '居住');
  await tap(page, '大約');
  await amount(page, '1.5萬');
  await tap(page, '儲存');
  await expect(page.getByRole('link', { name: /居住/ })).toBeVisible();

  await tab(page, '計畫');
  await page.getByRole('link', { name: '緊急預備金' }).click();
  await expect(page.getByText('試算結果')).toBeVisible();
  await tap(page, '儲存');
  await expect(page.locator('.goal-card')).toHaveCount(1);

  await page.reload();
  await tab(page, '計畫');
  await expect(page.locator('.goal-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});
