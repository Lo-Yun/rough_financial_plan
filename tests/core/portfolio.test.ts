import { describe, expect, it } from 'vitest';
import { computeBalanceSheet } from '../../src/core/balanceSheet';
import {
  analyzePortfolio,
  deviations,
  holdingCost,
  holdingsEstimateForAsset,
  holdingsProfit,
  holdingsTotal,
  holdingValue,
  normalizeAllocation,
  resolveTarget,
} from '../../src/core/portfolio';
import { twPack } from '../../src/locales/tw/pack';
import type { Asset, Holding } from '../../src/model/types';
import { asset, ctx } from '../helpers';

const today = '2026-10-22';
const stamp = '2026-01-01T00:00:00Z';
const exact = (value: number) => ({ mode: 'exact' as const, value, asOf: today });

function holding(assetId: string, extra: Partial<Holding>): Holding {
  return { id: `h-${extra.name}`, householdId: 'h', createdAt: stamp, updatedAt: stamp, assetId, name: 'x', assetClass: 'equity_domestic', ...extra };
}

function analyze(assets: Asset[], holdings: Holding[] = [], includeCash = false) {
  const bs = computeBalanceSheet(assets, [], ctx);
  return analyzePortfolio(bs.assets, holdings, ctx, twPack, includeCash);
}

describe('normalizeAllocation', () => {
  it('drops non-positive values and sums to one', () => {
    expect(normalizeAllocation({ equity_domestic: 7, bond: 3, cash: 0 })).toEqual({ equity_domestic: 0.7, bond: 0.3 });
    expect(normalizeAllocation({ cash: 0 })).toBeNull();
    expect(normalizeAllocation(undefined)).toBeNull();
  });
});

describe('holdings', () => {
  it('values quantity × price with currency conversion, or the estimated market value', () => {
    expect(holdingValue(holding('a', { quantity: 10, price: { value: 100, currency: 'USD', asOf: today } }), ctx)?.mid).toBe(32_000);
    expect(holdingValue(holding('a', { marketValue: { estimate: { mode: 'range', low: 1000, high: 3000 }, currency: 'TWD' } }), ctx)).toEqual({ low: 1000, mid: 2000, high: 3000 });
    expect(holdingValue(holding('a', {}), ctx)).toBeNull();
  });

  it('totals holdings and turns them into an asset estimate', () => {
    const priced = holdingsTotal(
      [
        holding('a', { name: 'p', quantity: 1000, price: { value: 150, currency: 'TWD', asOf: '2026-10-20' } }),
        holding('a', { name: 'q', quantity: 10, price: { value: 1000, currency: 'TWD', asOf: '2026-10-01' } }),
      ],
      ctx,
    );
    expect(priced.total.mid).toBe(160_000);
    expect(priced.allPriced).toBe(true);
    expect(holdingsEstimateForAsset(priced, today)).toEqual({ mode: 'exact', value: 160_000, asOf: '2026-10-01', source: 'manual' });

    const rough = holdingsTotal([holding('a', { marketValue: { estimate: { mode: 'range', low: 1000, high: 3000 }, currency: 'TWD' } })], ctx);
    expect(holdingsEstimateForAsset(rough, today)).toEqual({ mode: 'range', low: 1000, high: 3000 });
  });
});

describe('analyzePortfolio', () => {
  it('uses user allocation, defaults and holdings in that priority', () => {
    const stocks = asset(exact(600_000), { id: 's', category: 'investment', liquidity: 'semi_liquid', allocation: { equity_domestic: 0.7, bond: 0.3 } });
    const guess = asset(exact(200_000), { id: 'g', category: 'investment', liquidity: 'semi_liquid' });
    const broker = asset(exact(200_000), { id: 'b', category: 'investment', liquidity: 'semi_liquid', allocation: { bond: 1 } });
    const a = analyze(
      [stocks, guess, broker],
      [holding('b', { name: 'VT', assetClass: 'equity_global', marketValue: { estimate: exact(200_000), currency: 'TWD' } })],
    );
    expect(a.total.mid).toBe(1_000_000);
    expect(a.items.find((i) => i.asset.id === 's')!.source).toBe('user');
    expect(a.items.find((i) => i.asset.id === 'g')!.guessed).toBe(true);
    expect(a.items.find((i) => i.asset.id === 'b')!.source).toBe('holdings');
    expect(a.classShare.equity_domestic).toBeCloseTo(0.62);
    expect(a.classShare.equity_global).toBeCloseTo(0.2);
    expect(a.groupShare.equity).toBeCloseTo(0.82);
    expect(a.groupShare.bond).toBeCloseTo(0.18);
    expect(a.risk.level).toBe(5);
    expect(a.guessedCount).toBe(1);
    expect(a.concentration.map((c) => c.name)).toEqual([]);
  });

  it('excludes cash unless asked, and real estate always', () => {
    const items = [
      asset(exact(100_000), { id: 'c' }),
      asset(exact(100_000), { id: 'i', category: 'investment', liquidity: 'semi_liquid' }),
      asset(exact(5_000_000), { id: 'r', category: 'real_estate', liquidity: 'illiquid' }),
    ];
    expect(analyze(items).total.mid).toBe(100_000);
    const withCash = analyze(items, [], true);
    expect(withCash.total.mid).toBe(200_000);
    expect(withCash.groupShare.cash).toBeCloseTo(0.5);
  });

  it('flags a single holding above the concentration limit', () => {
    const acct = asset(exact(1_000_000), { id: 'a', category: 'investment', liquidity: 'semi_liquid' });
    const a = analyze(
      [acct],
      [
        holding('a', { name: 'TSMC', marketValue: { estimate: exact(500_000), currency: 'TWD' } }),
        holding('a', { name: 'ETF', marketValue: { estimate: exact(500_000), currency: 'TWD' } }),
      ],
    );
    expect(a.concentration.map((c) => c.name).sort()).toEqual(['ETF', 'TSMC']);
  });

  it('reports currency share and unresolved assets', () => {
    const usd = asset(exact(1000), { id: 'u', category: 'investment', liquidity: 'semi_liquid', value: { estimate: exact(1000), currency: 'USD' } });
    const twd = asset(exact(32_000), { id: 't', category: 'investment', liquidity: 'semi_liquid' });
    const unknown = asset({ mode: 'unknown' }, { id: 'x', category: 'crypto', liquidity: 'semi_liquid' });
    const a = analyze([usd, twd, unknown]);
    expect(a.currencyShare.USD).toBeCloseTo(0.5);
    expect(a.unresolvedCount).toBe(1);
    expect(a.unresolvedAssets.map((x) => x.id)).toEqual(['x']);
  });
});

describe('targets and deviations', () => {
  it('resolves presets, age rule and custom targets', () => {
    expect(resolveTarget(undefined, twPack, 30)).toEqual({ status: 'none' });
    expect(resolveTarget({ preset: 'balanced' }, twPack, null)).toMatchObject({ status: 'ok', allocation: { equity: 0.6 } });
    expect(resolveTarget({ preset: 'age_110' }, twPack, null)).toEqual({ status: 'needs_age', presetId: 'age_110' });
    const age = resolveTarget({ preset: 'age_110' }, twPack, 40);
    expect(age.status === 'ok' && age.allocation.equity).toBeCloseTo(0.7);
    expect(age.status === 'ok' && age.allocation.bond).toBeCloseTo(0.25);
    const custom = resolveTarget({ custom: { equity: 70, bond: 20, cash: 10, alternative: 0 } }, twPack, null);
    expect(custom.status === 'ok' && custom.allocation.equity).toBeCloseTo(0.7);
  });

  it('flags groups outside the rebalance band with amounts', () => {
    const acct = asset(exact(1_000_000), { id: 'a', category: 'investment', liquidity: 'semi_liquid', allocation: { equity_domestic: 0.8, bond: 0.2 } });
    const a = analyze([acct]);
    const d = deviations(a, { equity: 0.6, bond: 0.3, cash: 0.1, alternative: 0 }, 0.05);
    expect(d.needsRebalance).toBe(true);
    const eq = d.items.find((x) => x.group === 'equity')!;
    expect(eq.diff).toBeCloseTo(0.2);
    expect(eq.amount).toBeCloseTo(200_000);
    expect(d.items.find((x) => x.group === 'bond')!.outOfBand).toBe(true);
    expect(deviations(a, { equity: 0.78, bond: 0.22, cash: 0, alternative: 0 }, 0.05).needsRebalance).toBe(false);
  });
});

describe('unrealized profit and loss', () => {
  const twd = (value: number) => ({ estimate: exact(value), currency: 'TWD' });
  const priced = (name: string, quantity: number, price: number, cost?: number) =>
    holding('a', { name, quantity, price: { value: price, currency: 'TWD', asOf: today }, costBasis: cost === undefined ? undefined : twd(cost) });

  it('converts the cost basis to the base currency and ignores blank or zero costs', () => {
    expect(holdingCost(holding('a', { costBasis: { estimate: exact(100), currency: 'USD' } }), ctx)?.mid).toBe(3_200);
    expect(holdingCost(holding('a', {}), ctx)).toBeNull();
    expect(holdingCost(holding('a', { costBasis: twd(0) }), ctx)).toBeNull();
    expect(holdingCost(holding('a', { costBasis: { estimate: { mode: 'unknown' }, currency: 'TWD' } }), ctx)).toBeNull();
  });

  it('sums gains only over holdings that have both a value and a cost', () => {
    const p = holdingsProfit([priced('p', 1000, 150, 120_000), priced('q', 10, 1000, 12_000), priced('r', 10, 500)], ctx);
    expect(p).toEqual({ cost: 132_000, value: 160_000, gain: 28_000, ratio: 28_000 / 132_000, covered: 2, missing: 1 });
    expect(holdingsProfit([priced('r', 10, 500)], ctx)).toBeNull();
    expect(holdingsProfit([holding('a', { name: 's', costBasis: twd(100) })], ctx)).toBeNull();
  });

  it('reports losses as negative', () => {
    const p = holdingsProfit([priced('p', 100, 80, 10_000)], ctx);
    expect(p?.gain).toBe(-2_000);
    expect(p?.ratio).toBeCloseTo(-0.2);
  });

  it('adds profit per account and for the whole portfolio', () => {
    const broker = asset(exact(160_000), { id: 'b', category: 'investment' });
    const other = asset(exact(50_000), { id: 'o', category: 'investment' });
    const hs = [
      { ...priced('p', 1000, 150, 100_000), assetId: 'b' },
      { ...priced('q', 10, 1000), assetId: 'b' },
      { ...priced('x', 100, 500, 60_000), id: 'h-x', assetId: 'o' },
    ];
    const a = analyze([broker, other], hs);
    expect(a.items.find((i) => i.asset.id === 'b')?.profit).toMatchObject({ gain: 50_000, covered: 1, missing: 1 });
    expect(a.items.find((i) => i.asset.id === 'o')?.profit).toMatchObject({ gain: -10_000, covered: 1, missing: 0 });
    expect(a.profit).toMatchObject({ cost: 160_000, value: 200_000, gain: 40_000, covered: 2, missing: 1 });
    expect(analyze([other]).profit).toBeNull();
  });
});
