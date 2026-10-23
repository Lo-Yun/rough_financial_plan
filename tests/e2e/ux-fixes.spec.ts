import { expect, test } from '@playwright/test';
import { completeOnboarding, openWelcome, tab, tap, watchErrors } from './helpers';

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
  await tap(page, '範圍');
  const chip = page.locator('.chips button.chip').first();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await tab(page, '收支');
  await expect(page.getByText('過去一年，你的存款和投資本金大約增加了多少？')).toHaveCount(0);
  await tap(page, '檢查我的收支準不準 ›');
  await expect(page.getByText('過去一年，你的存款和投資本金大約增加了多少？')).toBeVisible();
  expect(errors).toEqual([]);
});

test('範圍模式：選金額選項不顯示輸入框，按「自訂金額範圍」才出現，已存的自訂範圍重新打開時直接顯示', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);
  await page.getByRole('link', { name: /新增資產/ }).first().click();
  await tap(page, '範圍');

  const custom = page.getByRole('button', { name: '自訂金額範圍' });
  await expect(page.getByLabel('最少')).toHaveCount(0);
  await expect(custom).toHaveAttribute('aria-pressed', 'false');

  await custom.click();
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('最少')).toHaveValue('');
  await expect(page.getByLabel('最少')).toBeFocused();
  await expect(page.getByLabel('最多')).toHaveValue('');
  await expect(page.getByText('可以直接寫「萬」，例如 600萬')).toHaveCount(1);

  await tap(page, '10 萬 以下');
  await expect(page.getByLabel('最少')).toHaveCount(0);
  await expect(custom).toHaveAttribute('aria-pressed', 'false');

  await custom.click();
  await expect(page.getByLabel('最少')).toHaveValue('');
  await page.getByLabel('最少').fill('45萬');
  await page.getByLabel('最多').fill('80萬');
  await page.getByLabel('名稱（可以不填）').fill('自訂範圍測試');
  await tap(page, '儲存');

  await page.getByRole('link', { name: /自訂範圍測試/ }).click();
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('最少')).toHaveValue('450,000');
  await expect(page.getByLabel('最多')).toHaveValue('800,000');
  expect(errors).toEqual([]);
});

test('新增項目預設「大約」；金額輸入框純數字時顯示千分位，其他寫法照原樣', async ({ page }) => {
  const errors = watchErrors(page);
  await completeOnboarding(page);
  await page.getByRole('link', { name: /新增資產/ }).first().click();
  await expect(page.getByRole('radio', { name: '大約' })).toHaveAttribute('aria-checked', 'true');

  const input = page.getByPlaceholder('例如 35000 或 600萬');
  await input.pressSequentially('1234567');
  await expect(input).toHaveValue('1,234,567');
  await input.fill('45萬');
  await expect(input).toHaveValue('45萬');
  await input.fill('');
  await input.pressSequentially('12000');
  // 在中間插入數字，游標要留在插入的位置
  await input.press('Home');
  await input.press('ArrowRight');
  await input.pressSequentially('5');
  await expect(input).toHaveValue('152,000');
  await input.pressSequentially('9');
  await expect(input).toHaveValue('1,592,000');

  await tab(page, '收支');
  await page.getByRole('link', { name: '+ 新增支出' }).click();
  await expect(page.getByRole('radio', { name: '大約' })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('快速估算與對帳檢查預設「大約」；對帳可以填負數', async ({ page }) => {
  const errors = watchErrors(page);
  await openWelcome(page);
  await tap(page, '開始估算');
  await tap(page, '單身');
  await tap(page, '下一步');
  await expect(page.getByRole('radio', { name: '大約' })).toHaveAttribute('aria-checked', 'true');

  await completeOnboarding(page);
  await tab(page, '收支');
  await tap(page, '檢查我的收支準不準 ›');
  await expect(page.getByRole('radio', { name: '大約' })).toHaveAttribute('aria-checked', 'true');
  await page.getByPlaceholder('例如 35000 或 600萬').fill('-5萬');
  await tap(page, '檢查');
  await expect(page.getByText('你說實際增加')).toBeVisible();
  await expect(page.getByText('還不知道每月結餘')).toHaveCount(0);
  expect(errors).toEqual([]);
});
