import { describe, expect, it } from 'vitest';
import { buildSnapshotData, computeOverview, type FinancialData } from '../../src/core/overview';
import { twPack } from '../../src/locales/tw/pack';
import { asset, household, liability, settings } from '../helpers';

const today = '2026-10-22';

function data(extra: Partial<FinancialData> = {}): FinancialData {
  return { household, settings, assets: [], liabilities: [], incomes: [], expenses: [], ...extra };
}

describe('computeOverview', () => {
  it('suggests unresolved items first', () => {
    const unknownHome = asset({ mode: 'unknown' }, { category: 'real_estate', liquidity: 'illiquid' });
    const o = computeOverview(data({ assets: [asset({ mode: 'approx', value: 1e6 }), unknownHome] }), twPack, today);
    expect(o.nextRefinement).toEqual({ kind: 'asset', id: unknownHome.id, reason: 'unknown' });
  });

  it('then suggests the largest uncertainty', () => {
    const big = liability({ mode: 'range', low: 5e6, high: 7e6 }, { category: 'mortgage', secured: true });
    const o = computeOverview(
      data({ assets: [asset({ mode: 'approx', value: 1e6 })], liabilities: [big] }),
      twPack,
      today,
    );
    expect(o.nextRefinement).toEqual({ kind: 'liability', id: big.id, reason: 'imprecise' });
  });

  it('returns null when everything is exact and fresh', () => {
    const o = computeOverview(data({ assets: [asset({ mode: 'exact', value: 1, asOf: '2026-10-01' })] }), twPack, today);
    expect(o.nextRefinement).toBeNull();
    expect(o.precision.score).toBe(1);
  });

  it('computes monthly cashflow with frequency normalization', () => {
    const stamp = '2026-01-01T00:00:00Z';
    const o = computeOverview(
      data({
        incomes: [
          { id: 'i1', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'salary', amount: { estimate: { mode: 'exact', value: 50000, asOf: today }, currency: 'TWD' }, frequency: 'monthly', isRecurring: true, basis: 'net' },
          { id: 'i2', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'bonus', amount: { estimate: { mode: 'exact', value: 120000, asOf: today }, currency: 'TWD' }, frequency: 'yearly', isRecurring: false, basis: 'net' },
        ],
        expenses: [
          { id: 'e1', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'other', amount: { estimate: { mode: 'unknown', statKey: 'expense.monthly_total.single' }, currency: 'TWD' }, frequency: 'monthly', essential: true },
        ],
      }),
      twPack,
      today,
    );
    expect(o.income.total?.mid).toBe(60000);
    expect(o.expense.total?.mid).toBe(25000);
  });

  it('builds snapshot data', () => {
    const d = data({ assets: [asset({ mode: 'exact', value: 500_000, asOf: today })] });
    const o = computeOverview(d, twPack, today);
    const s = buildSnapshotData(d, o, twPack, today, 'manual');
    expect(s.summary.netWorth.mid).toBe(500_000);
    expect(s.summary.ladderLevel).toBe(2);
    expect(s.items.assets).toHaveLength(1);
    expect(s.localePackVersion).toBe(twPack.version);
  });
});
