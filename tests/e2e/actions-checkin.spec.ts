import { expect, test } from '@playwright/test';
import { completeOnboarding, tap, watchErrors } from './helpers';

test('卡債優先建議、接受行動、財富階梯、每月回顧', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page, { cardDebt: true });

  // 有卡債循環時，第一個建議是先還卡債
  const card = page.locator('.actions-card');
  await expect(card.locator('.suggestion-title')).toContainText('先還清信用卡循環');
  await card.getByRole('button', { name: '加入行動' }).click();
  await expect(card.locator('.active-action')).toContainText('先還清信用卡循環');

  // 行動清單：新增自訂行動
  await card.getByRole('link', { name: /全部建議/ }).click();
  await page.getByPlaceholder(/自己想做的事/).fill('取消一個用不到的訂閱');
  await tap(page, '新增');
  await expect(page.locator('.active-action')).toHaveCount(2);

  // 財富階梯頁
  await page.goto('./#/ladder');
  await expect(page.getByRole('heading', { level: 1, name: '財富階梯' })).toBeVisible();
  await expect(page.locator('.ladder-list li')).toHaveCount(6);
  await expect(page.locator('.ladder-list li.current')).toHaveCount(1);

  // 每月回顧
  await page.goto('./#/checkin');
  await tap(page, '沒有');
  await tap(page, '下一步');
  const rows = page.locator('.review-row');
  await expect(rows.first()).toBeVisible();
  await rows.first().getByRole('button', { name: '沒變' }).click();
  await expect(rows.first()).toContainText('沒變');
  await tap(page, '下一步');
  await page.locator('.action-list input[type=checkbox]').first().click();
  await expect(page.locator('.action-list .ok')).toHaveCount(1);
  await tap(page, '下一步');
  await tap(page, '還不錯');
  await tap(page, '完成回顧');
  await expect(page.getByRole('heading', { name: '回顧完成！' })).toBeVisible();
  await expect(page.getByText('這是你第 1 次回顧。')).toBeVisible();

  await tap(page, '回到淨值');
  await expect(page.locator('.checkin-due')).toHaveCount(0);
  await expect(page.locator('.actions-card .active-action')).toHaveCount(1);
  expect(errors).toEqual([]);
});
