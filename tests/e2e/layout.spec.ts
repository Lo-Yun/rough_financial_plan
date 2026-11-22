import { expect, test, type Page } from '@playwright/test';
import { openWelcome, tap, watchErrors } from './helpers';

// 視覺規範第 10 節：淺色、深色模式下，320px 寬都不能橫向捲動；字級只能是 6 級（加上歡迎頁的品牌字級）。
const ROUTES = ['#/', '#/history', '#/portfolio', '#/portfolio/target', '#/settings', '#/asset/new', '#/liability/new'];
const FONT_SIZES = [12, 14, 16, 18, 22, 40, 28];

async function checkLayout(page: Page, label: string) {
  const r = await page.evaluate((allowed) => {
    const bad = new Set<string>();
    for (const el of document.querySelectorAll('body *')) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (!allowed.includes(Math.round(fs * 100) / 100)) bad.add(`${el.tagName.toLowerCase()} ${fs}px`);
    }
    return { scroll: document.documentElement.scrollWidth, width: window.innerWidth, badFonts: [...bad] };
  }, FONT_SIZES);
  expect(r.scroll, `${label} 橫向捲動`).toBeLessThanOrEqual(r.width);
  expect(r.badFonts, `${label} 字級`).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`v1 每頁在 320px 寬（${scheme}）不能橫向捲動、只用規範字級`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme: scheme });

    await page.goto('./');
    await expect(page.getByRole('button', { name: 'OK，順便做吧！' })).toBeVisible();
    await checkLayout(page, 'welcome-1');
    await openWelcome(page);
    await checkLayout(page, 'welcome-2');

    await tap(page, '先看看填好的樣子（示範資料）');
    await expect(page.locator('.demo-banner')).toBeVisible();
    for (const route of ROUTES) {
      await page.goto(`./${route}`);
      await expect(page.locator('.demo-banner')).toBeVisible();
      await expect(page.locator('.page').first()).toBeVisible();
      await checkLayout(page, route);
    }
    await page.goto('./#/portfolio');
    await page.locator('a[href*="/holdings"]').filter({ hasText: /[1-9]/ }).first().click();
    await expect(page.locator('.item-list a').first()).toBeVisible();
    await checkLayout(page, 'holdings');
    await page.locator('.item-list a').first().click();
    await expect(page.locator('form.card')).toBeVisible();
    await checkLayout(page, 'holding editor');
    expect(errors).toEqual([]);
  });
}
