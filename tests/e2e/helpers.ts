import { expect, type Page } from '@playwright/test';

/** 依按鈕文字精確點擊（包含 role="radio" 的分段按鈕） */
export async function tap(page: Page, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('button').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first().click();
}

export async function amount(page: Page, value: string, nth = 0) {
  await page.getByPlaceholder('例如 35000 或 600萬').nth(nth).fill(value);
}

export async function tab(page: Page, name: string) {
  await page.locator('.tab-bar a', { hasText: name }).click();
}

/** 收集主控台錯誤與未捕捉的例外，測試結束時檢查 */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => void d.accept());
  return errors;
}

export interface OnboardingOptions {
  /** 加上一筆約 6 萬的信用卡循環 */
  cardDebt?: boolean;
  /** 投資約 40 萬 */
  investment?: boolean;
}

/** 走完快速估算：單身、月收入 5～8 萬、年終 2 個月、月花費約 4 萬、存款 30～100 萬 */
export async function completeOnboarding(page: Page, opts: OnboardingOptions = {}) {
  await page.goto('./');
  await tap(page, '開始估算');
  await tap(page, '單身');
  await tap(page, '下一步');
  await tap(page, '範圍');
  await tap(page, '5 萬 ～ 8 萬');
  await tap(page, '下一步');
  await tap(page, '2 個月');
  await tap(page, '下一步');
  await tap(page, '大約');
  await amount(page, '4萬');
  await tap(page, '下一步');
  await tap(page, '範圍');
  await tap(page, '30 萬 ～ 100 萬');
  await tap(page, '下一步');
  if (opts.investment) {
    await tap(page, '有');
    await tap(page, '大約');
    await amount(page, '40萬');
  }
  await tap(page, '下一步');
  await tap(page, '下一步'); // 房子：沒有
  await tap(page, '下一步'); // 車子：沒有
  if (opts.cardDebt) {
    await tap(page, '卡債（信用卡循環）');
    await page.locator('.sub-question').locator('button', { hasText: /^\s*大約\s*$/ }).click();
    await page.locator('.sub-question').getByPlaceholder('例如 35000 或 600萬').fill('6萬');
  }
  await tap(page, '看結果');
  await expect(page.getByText('你的淨值（身價）')).toBeVisible();
  await tap(page, '進入我的財務');
  await expect(page.locator('.tab-bar')).toBeVisible();
}
