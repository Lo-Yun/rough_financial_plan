import { expect, test } from '@playwright/test';
import { completeOnboarding, openWelcome, tab, tap, watchErrors } from './helpers';

test('從歡迎頁進入示範，每個頁面都有資料，離開後回到歡迎頁', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await tap(page, '先看看填好的樣子（示範資料）');
  await expect(page.locator('.demo-banner')).toBeVisible();
  await expect(page.getByText('證券帳戶')).toBeVisible();

  await tab(page, '投資');
  await expect(page.getByRole('heading', { name: '再平衡提示' })).toBeVisible();
  await tab(page, '計畫');
  await expect(page.locator('.goal-card')).toHaveCount(3);
  await page.goto('./#/history');
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  await page.locator('.demo-banner').getByRole('button', { name: '離開示範' }).click();
  await expect(page.getByRole('button', { name: '開始估算' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('示範中的修改不會影響真實資料', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);
  await tab(page, '設定');
  await tap(page, '試玩示範資料');
  await expect(page.locator('.demo-banner')).toBeVisible();

  // 示範模式不提供備份與刪除
  await tab(page, '設定');
  await expect(page.getByRole('heading', { name: '刪除資料' })).toHaveCount(0);
  await tap(page, '離開示範');

  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('.tab-bar')).toBeVisible();
  await expect(page.getByText('證券帳戶')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('第一次打開先看到品牌頁，按下後才到「開始估算」；離開示範後不再出現品牌頁', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '順便理財' })).toBeVisible();
  await expect(page.getByRole('button', { name: '開始估算' })).toHaveCount(0);
  await tap(page, 'OK，順便做吧！');
  await expect(page.getByRole('button', { name: '開始估算' })).toBeVisible();
  await expect(page.locator('.brand img')).toBeVisible();

  await tap(page, '先看看填好的樣子（示範資料）');
  await tap(page, '離開示範');
  await expect(page.getByRole('button', { name: '開始估算' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'OK，順便做吧！' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
