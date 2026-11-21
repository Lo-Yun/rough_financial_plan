import { expect, test } from '@playwright/test';
import { amount, completeOnboarding, openWelcome, tap, watchErrors } from './helpers';

test('淨值頁：總覽列出資產與負債、同類別分組小計、一次只有一張提醒卡', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { investment: true, cardDebt: true });

  const hero = page.locator('.card.hero');
  await expect(hero.locator('.hero-equation dt')).toHaveText(['資產', '負債']);

  // 新使用者：只有「下一步」，沒有備份提醒
  await expect(page.locator('.card.next-step')).toHaveCount(1);
  await expect(page.locator('.card.attention, .card.tip')).toHaveCount(0);

  // 再加一筆現金，現金類別變成分組並顯示小計
  await page.getByRole('link', { name: /新增資產/ }).first().click();
  await tap(page, '大約');
  await amount(page, '10萬');
  await page.getByLabel('名稱（可以不填）').fill('第二個帳戶');
  await tap(page, '儲存');

  const group = page.locator('.item-group');
  await expect(group).toHaveCount(1);
  await expect(group.locator('.group-head')).toContainText('現金');
  await expect(group.locator('.item-list.sub li')).toHaveCount(2);
  await expect(group.getByRole('link', { name: /第二個帳戶/ })).toBeVisible();

  // 320px 寬不能橫向捲動
  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('負債編輯：利率與每月還款收在「更多細節」裡', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);
  await page.getByRole('link', { name: /新增負債/ }).first().click();

  const more = page.locator('details.more-details');
  await expect(more).not.toHaveAttribute('open', '');
  await expect(page.getByText('我知道每月要還多少')).toBeHidden();
  await more.locator('summary').click();
  await expect(page.getByText('我知道每月要還多少')).toBeVisible();
  expect(errors).toEqual([]);
});

test('淨值趨勢：首頁小趨勢卡與歷史頁折線圖（手寫 SVG）', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await tap(page, '先看看填好的樣子（示範資料）');

  const card = page.locator('.trend-card');
  await expect(card).toBeVisible();
  await expect(card.locator('svg .lc-line')).toHaveCount(1);
  await expect(card).toContainText(/比 \d{4}-\d{2}-\d{2} (多了|少了)|差不多/);

  await card.click();
  await expect(page.getByRole('heading', { level: 1, name: '淨值歷史' })).toBeVisible();
  const chart = page.getByRole('img', { name: '淨值隨時間變化的折線圖，陰影為估算範圍' });
  await expect(chart.locator('.lc-band')).toHaveCount(1);
  await expect(chart.locator('.lc-line')).toHaveCount(1);
  const tip = page.locator('.lc-tip');
  const latest = await tip.textContent();
  // 鍵盤左移到前一筆，提示框跟著換
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.lc-cross')).toHaveCount(1);
  await expect(tip).not.toHaveText(latest ?? '');
  expect(errors).toEqual([]);
});

test('快照少於兩筆時，首頁只有歷史連結', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.locator('.trend-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /淨值歷史與曲線/ })).toBeVisible();
});
