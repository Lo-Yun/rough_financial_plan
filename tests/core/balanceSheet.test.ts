import { describe, expect, it } from 'vitest';
import { computeBalanceSheet } from '../../src/core/balanceSheet';
import { asset, ctx, liability } from '../helpers';

describe('computeBalanceSheet', () => {
  it('sums assets and subtracts liabilities with conservative intervals', () => {
    const bs = computeBalanceSheet(
      [asset({ mode: 'range', low: 100, high: 200 }), asset({ mode: 'exact', value: 50, asOf: '2026-10-01' })],
      [liability({ mode: 'range', low: 10, high: 30 })],
      ctx,
    );
    expect(bs.totalAssets).toEqual({ low: 150, mid: 200, high: 250 });
    expect(bs.totalLiabilities).toEqual({ low: 10, mid: 20, high: 30 });
    expect(bs.netWorth).toEqual({ low: 120, mid: 180, high: 240 });
  });

  it('converts foreign currency and reports missing fx', () => {
    const bs = computeBalanceSheet(
      [
        asset({ mode: 'exact', value: 100, asOf: '2026-10-01' }, { value: { estimate: { mode: 'exact', value: 100, asOf: '2026-10-01' }, currency: 'USD' } }),
        asset({ mode: 'exact', value: 1, asOf: '2026-10-01' }, { value: { estimate: { mode: 'exact', value: 1, asOf: '2026-10-01' }, currency: 'JPY' } }),
      ],
      [],
      ctx,
    );
    expect(bs.totalAssets.mid).toBe(3200);
    expect(bs.unresolvedCount).toBe(1);
    expect(bs.missingFxCurrencies).toEqual(['JPY']);
  });

  it('skips unknown items without statistics and archived items', () => {
    const bs = computeBalanceSheet(
      [asset({ mode: 'unknown' }), asset({ mode: 'exact', value: 5, asOf: '2026-10-01' }, { archivedAt: '2026-10-02T00:00:00Z' })],
      [],
      ctx,
    );
    expect(bs.totalAssets.mid).toBe(0);
    expect(bs.unresolvedCount).toBe(1);
    expect(bs.assets).toHaveLength(1);
  });

  it('accessible net worth excludes primary residence and its mortgage', () => {
    const home = asset({ mode: 'exact', value: 1000, asOf: '2026-10-01' }, { category: 'real_estate', liquidity: 'illiquid', isPrimaryResidence: true });
    const cash = asset({ mode: 'exact', value: 100, asOf: '2026-10-01' });
    const linked = liability({ mode: 'exact', value: 600, asOf: '2026-10-01' }, { category: 'mortgage', secured: true, securedByAssetId: home.id });
    const unlinkedCar = liability({ mode: 'exact', value: 50, asOf: '2026-10-01' }, { category: 'car_loan', secured: true });
    const card = liability({ mode: 'exact', value: 30, asOf: '2026-10-01' }, { category: 'credit_card' });
    const bs = computeBalanceSheet([home, cash], [linked, unlinkedCar, card], ctx);
    expect(bs.netWorth.mid).toBe(1100 - 680);
    expect(bs.accessibleNetWorth.mid).toBe(100 - 30);
  });

  it('a loan secured by an accessible asset counts against accessible net worth', () => {
    const stocks = asset({ mode: 'exact', value: 500, asOf: '2026-10-01' }, { category: 'investment', liquidity: 'semi_liquid' });
    const pledge = liability({ mode: 'exact', value: 200, asOf: '2026-10-01' }, { category: 'other', secured: true, securedByAssetId: stocks.id });
    expect(computeBalanceSheet([stocks], [pledge], ctx).accessibleNetWorth.mid).toBe(300);
  });

  it('groups by category', () => {
    const bs = computeBalanceSheet(
      [asset({ mode: 'exact', value: 1, asOf: '2026-10-01' }), asset({ mode: 'exact', value: 2, asOf: '2026-10-01' }), asset({ mode: 'exact', value: 4, asOf: '2026-10-01' }, { category: 'vehicle', liquidity: 'illiquid' })],
      [],
      ctx,
    );
    expect(bs.byAssetCategory.cash?.mid).toBe(3);
    expect(bs.byAssetCategory.vehicle?.mid).toBe(4);
  });
});

describe('interval div', () => {
  it('divides by positive ranges only', async () => {
    const { div } = await import('../../src/core/interval');
    expect(div({ low: 10, mid: 20, high: 30 }, { low: 2, mid: 4, high: 5 })).toEqual({ low: 2, mid: 5, high: 15 });
    expect(div({ low: -10, mid: 0, high: 10 }, { low: 2, mid: 4, high: 5 })).toEqual({ low: -5, mid: 0, high: 5 });
    expect(div({ low: 1, mid: 1, high: 1 }, { low: 0, mid: 1, high: 2 })).toBeNull();
  });
});
