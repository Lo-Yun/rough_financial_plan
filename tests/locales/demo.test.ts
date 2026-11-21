import { describe, expect, it } from 'vitest';
import { computeAdvice } from '../../src/core/advice';
import { resolveMoney } from '../../src/core/currency';
import { computeOverview, moneyContext } from '../../src/core/overview';
import { analyzePortfolio, deviations, holdingValue, resolveTarget } from '../../src/core/portfolio';
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

  it('gives the portfolio dashboard costs, gains and losses, and a rebalance hint', () => {
    const ctx = moneyContext(data, twPack);
    const pl = p.holdings
      .filter((h) => h.assetClass !== 'cash')
      .map((h) => {
        expect(h.costBasis, h.name).toBeDefined();
        const cost = resolveMoney(h.costBasis!, ctx);
        expect(cost.status, h.name).toBe('ok');
        return holdingValue(h, ctx)!.mid - (cost.status === 'ok' ? cost.range.mid : 0);
      });
    expect(pl.some((v) => v > 0)).toBe(true);
    expect(pl.some((v) => v < 0)).toBe(true);

    const a = analyzePortfolio(overview.balanceSheet.assets, p.holdings, ctx, twPack, !!p.settings.portfolioIncludeCash);
    expect(a.concentration).toHaveLength(0);
    const target = resolveTarget(p.assumptions?.targetAllocation, twPack, 36);
    expect(target.status).toBe('ok');
    if (target.status !== 'ok') return;
    const off = deviations(a, target.allocation, twPack.rebalanceBand).items.filter((d) => d.outOfBand);
    expect(off.map((d) => d.group).sort()).toEqual(['bond', 'equity']);
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
