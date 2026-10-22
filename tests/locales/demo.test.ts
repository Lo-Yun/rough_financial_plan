import { describe, expect, it } from 'vitest';
import { computeAdvice } from '../../src/core/advice';
import { computeOverview } from '../../src/core/overview';
import { resolveAssumptions } from '../../src/core/planning';
import { buildTwDemo } from '../../src/locales/tw/demo';
import { twPack } from '../../src/locales/tw/pack';

const today = '2026-10-22';

describe('Taiwan demo data', () => {
  const p = buildTwDemo(twPack, today);
  const data = { household: p.household, settings: p.settings, assets: p.assets, liabilities: p.liabilities, incomes: p.incomeItems, expenses: p.expenseItems };
  const overview = computeOverview(data, twPack, today);

  it('describes a plausible family with every item resolved', () => {
    expect(overview.balanceSheet.unresolvedCount ?? 0).toBe(0);
    const nw = overview.balanceSheet.netWorth.mid;
    expect(nw).toBeGreaterThan(3_000_000);
    expect(overview.ladder.level).toBe(3);
  });

  it('has a year of rising history ending a month ago', () => {
    expect(p.snapshots).toHaveLength(12);
    expect(p.snapshots.at(-1)!.date).toBe('2026-09-22');
    const nws = p.snapshots.map((s) => s.summary.netWorth.mid);
    for (let i = 1; i < nws.length; i++) expect(nws[i]!).toBeGreaterThan(nws[i - 1]!);
    expect(nws.at(-1)!).toBeLessThan(overview.balanceSheet.netWorth.mid);
    expect(p.checkIns).toHaveLength(11);
  });

  it('keeps every reference inside the payload', () => {
    const assetIds = new Set(p.assets.map((a) => a.id));
    for (const h of p.holdings) expect(assetIds.has(h.assetId)).toBe(true);
    for (const l of p.liabilities) if (l.securedByAssetId) expect(assetIds.has(l.securedByAssetId)).toBe(true);
    const snapIds = new Set(p.snapshots.map((s) => s.id));
    for (const c of p.checkIns) expect(snapIds.has(c.snapshotId!)).toBe(true);
    for (const row of [...p.assets, ...p.liabilities, ...p.incomeItems, ...p.expenseItems, ...p.goals, ...p.holdings, ...p.userActions]) {
      expect(row.householdId).toBe(p.household.id);
    }
  });

  it('gives the action board something to show', () => {
    const advice = computeAdvice({
      data, overview, pack: twPack, goals: p.goals, holdings: p.holdings,
      assumptions: resolveAssumptions(p.assumptions, twPack), storedAssumptions: p.assumptions,
      age: 36, snapshotCount: p.snapshots.length, actions: p.userActions, today,
    });
    expect(advice.board.suggestions.length).toBeGreaterThan(0);
    expect(advice.board.active).toHaveLength(1);
    expect(advice.board.done).toHaveLength(1);
  });
});
