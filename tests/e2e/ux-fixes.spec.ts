import { expect, test } from '@playwright/test';
import { completeOnboarding, tab, tap, watchErrors } from './helpers';

test('買房提示、範圍留白、選項按鈕有選取狀態、對帳預設收合', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);

  await tab(page, '計畫');
  await page.getByRole('link', { name: '+ 新增計畫' }).click();
  await page.getByRole('button', { name: /^買房頭期款/ }).click();
  await expect(page.getByText('填上房屋總價，就能算出需要準備的頭期款。')).toBeVisible();
  await expect(page.getByText('到「收支」補上支出')).toHaveCount(0);

  await tab(page, '淨值');
  await page.getByRole('link', { name: /新增資產/ }).first().click();
  await expect(page.getByLabel('最少')).toHaveValue('');
  await expect(page.getByLabel('最多')).toHaveValue('');
  await expect(page.getByText('可以直接寫「萬」，例如 600萬')).toHaveCount(1);
  const chip = page.locator('.chips button.chip').first();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await tab(page, '收支');
  await expect(page.getByText('過去一年，你的存款和投資本金大約增加了多少？')).toHaveCount(0);
  await tap(page, '檢查我的收支準不準 ›');
  await expect(page.getByText('過去一年，你的存款和投資本金大約增加了多少？')).toBeVisible();
  expect(errors).toEqual([]);
});
