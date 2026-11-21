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

test('v1 快速估算只有 5 題資產負債題，沒有收支題，結果頁沒有每月結餘', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await expect(page.getByText('存款、投資、房子、車子、負債')).toBeVisible();
  await expect(page.getByText('10 多個問題')).toHaveCount(0);
  await tap(page, '開始估算');

  const titles = ['現金和存款大約有多少？', '有沒有股票、ETF、基金等投資？', '有沒有自己住的房子？', '有沒有汽車或機車？', '目前有哪些貸款或欠款？'];
  for (const [i, title] of titles.entries()) {
    await expect(page.locator('.card.question h2')).toHaveText(title);
    await expect(page.getByRole('progressbar', { name: `第 ${i + 1} 題，共 5 題` })).toBeVisible();
    await expect(page.getByText(/家庭狀況|收入|年終|花多少/)).toHaveCount(0);
    if (i === 0) {
      await tap(page, '範圍');
      await tap(page, '30 萬 ～ 100 萬');
    }
    await tap(page, i === titles.length - 1 ? '看結果' : '下一步');
  }

  await expect(page.getByText('你的淨值（身價）')).toBeVisible();
  await expect(page.getByText('精確度', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('每個月大約可以存下')).toHaveCount(0);
  await expect(page.getByText(/每月大約不夠/)).toHaveCount(0);
  await expect(page.locator('.card.ladder')).toBeVisible();
  await expect(page.getByRole('heading', { name: '下一步' })).toBeVisible();
  await tap(page, '進入我的財務');
  await expect(page.locator('.tab-bar')).toBeVisible();
  expect(errors).toEqual([]);
});
