import { expect, test } from '@playwright/test';
import { completeOnboarding, openWelcome, tab, tap, watchErrors } from './helpers';

// v1 範圍（決策 D21）：只有淨值、投資、設定；其他功能隱藏，網址打進去會回到淨值頁。
// 這個檔案只在預設建置跑；隱藏功能的測試標記 @full，在全功能建置跑。

test('v1 分頁列只有淨值、投資、設定，每個分頁與淨值歷史都能開啟', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { investment: true });
  await expect(page.locator('.tab-bar a')).toHaveCount(3);
  await expect(page.locator('.tab-bar a')).toHaveText(['淨值', '投資', '設定']);
  await expect(page.locator('.tab-bar a svg')).toHaveCount(3);

  await tab(page, '投資');
  await expect(page.getByRole('heading', { level: 1, name: '投資組合' })).toBeVisible();
  await tab(page, '設定');
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '試算假設' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '定期回顧' })).toHaveCount(0);
  await page.goto('./#/history');
  await expect(page.getByRole('heading', { level: 1, name: '淨值歷史' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('v1 淨值頁沒有行動卡與財富階梯完整頁連結，隱藏功能的網址回到淨值頁', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { cardDebt: true });
  await expect(page.locator('.card.ladder')).toBeVisible();
  await expect(page.locator('.card.ladder a')).toHaveCount(0);
  await expect(page.locator('.actions-card')).toHaveCount(0);
  await expect(page.locator('.checkin-due')).toHaveCount(0);

  for (const path of ['cashflow', 'health', 'plans', 'plans/new', 'actions', 'ladder', 'checkin', 'expense/new']) {
    await page.goto(`./#/${path}`);
    await expect(page.locator('.card.hero')).toContainText('精確度');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('v1 示範資料：淨值與投資頁有資料', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await tap(page, '先看看填好的樣子（示範資料）');
  await expect(page.locator('.tab-bar a')).toHaveCount(3);
  await expect(page.locator('.item-list .icon-badge svg').first()).toBeVisible();
  await expect(page.locator('.actions-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});
