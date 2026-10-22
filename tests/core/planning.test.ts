import { describe, expect, it } from 'vitest';
import { computeOverview, moneyContext, type FinancialData } from '../../src/core/overview';
import {
  futureValue,
  monthlyRate,
  monthsBetween,
  monthsToTarget,
  projectGoal,
  realRate,
  requiredMonthly,
  resolveAssumptions,
  scenarioRates,
} from '../../src/core/planning';
import { twPack } from '../../src/locales/tw/pack';
import type { ExpenseItem, Goal, IncomeItem } from '../../src/model/types';
import { asset, household, liability, settings } from '../helpers';

const today = '2026-10-22';
const stamp = '2026-01-01T00:00:00Z';

describe('time value of money', () => {
  it('real and monthly rates', () => {
    expect(realRate(0.05, 0.02)).toBeCloseTo(0.0294, 4);
    expect((1 + monthlyRate(0.06)) ** 12).toBeCloseTo(1.06);
  });

  it('requiredMonthly and monthsToTarget are consistent with futureValue', () => {
    const i = monthlyRate(0.03);
    const p = requiredMonthly(1_000_000, 100_000, i, 60);
    expect(futureValue(100_000, p, i, 60)).toBeCloseTo(1_000_000, 0);
    expect(monthsToTarget(1_000_000, 100_000, p, i)).toBe(60);
  });

  it('zero rate', () => {
    expect(requiredMonthly(1200, 0, 0, 12)).toBe(100);
    expect(monthsToTarget(1200, 0, 100, 0)).toBe(12);
    expect(monthsToTarget(1200, 0, 0, 0)).toBeNull();
  });

  it('already reached and unreachable', () => {
    expect(requiredMonthly(100, 200, 0.01, 12)).toBe(0);
    expect(monthsToTarget(100, 200, 0, 0.01)).toBe(0);
    // 負實質報酬、沒有投入，永遠達不到
    expect(monthsToTarget(1000, 500, 0, monthlyRate(-0.01))).toBeNull();
  });

  it('monthsBetween counts whole months', () => {
    expect(monthsBetween('2026-10-22', '2027-10-22')).toBe(12);
    expect(monthsBetween('2026-10-22', '2027-10-21')).toBe(11);
  });

  it('scenario rates order and cash spread', () => {
    const a = resolveAssumptions(undefined, twPack);
    const g = scenarioRates('growth', a);
    expect(g.conservative).toBeLessThan(g.neutral);
    expect(g.neutral).toBeLessThan(g.optimistic);
    const c = scenarioRates('cash', a);
    expect(c.optimistic - c.conservative).toBeLessThan(g.optimistic - g.conservative);
    expect(resolveAssumptions({ householdId: 'h', inflation: 0.03 }, twPack).inflation).toBe(0.03);
  });
});

function income(value: number): IncomeItem {
  return { id: 'i', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'salary', amount: { estimate: { mode: 'exact', value, asOf: today }, currency: 'TWD' }, frequency: 'monthly', isRecurring: true, basis: 'net' };
}
function expense(value: number, extra: Partial<ExpenseItem> = {}): ExpenseItem {
  return { id: `e${value}`, householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'other', amount: { estimate: { mode: 'exact', value, asOf: today }, currency: 'TWD' }, frequency: 'monthly', essential: true, ...extra };
}
function goal(g: Partial<Goal>): Goal {
  return { id: 'g', householdId: 'h', createdAt: stamp, updatedAt: stamp, type: 'custom', priority: 1, status: 'active', ...g };
}

function ctxFor(d: Partial<FinancialData>) {
  const data: FinancialData = { household, settings, assets: [], liabilities: [], incomes: [], expenses: [], ...d };
  return {
    overview: computeOverview(data, twPack, today),
    money: moneyContext(data, twPack),
    assumptions: resolveAssumptions(undefined, twPack),
    pack: twPack,
    today,
  };
}

describe('projectGoal', () => {
  it('emergency fund: auto target from essential expense, current from liquid assets', () => {
    const ctx = ctxFor({
      incomes: [income(60_000)],
      expenses: [expense(30_000), expense(10_000, { essential: false })],
      assets: [asset({ mode: 'exact', value: 90_000, asOf: today })],
    });
    const p = projectGoal(goal({ type: 'emergency_fund', params: { kind: 'emergency_fund', months: 6 } }), ctx);
    expect(p.target?.mid).toBe(180_000);
    expect(p.current.mid).toBe(90_000);
    expect(p.progress).toBeCloseTo(0.5);
    expect(p.contributionSource).toBe('surplus');
    expect(p.contribution).toBe(20_000);
    expect(p.eta?.expected).toBeGreaterThanOrEqual(4);
    expect(p.eta?.expected).toBeLessThanOrEqual(5);
  });

  it('custom goal with date gives a required monthly range', () => {
    const ctx = ctxFor({ incomes: [income(60_000)], expenses: [expense(40_000)] });
    const p = projectGoal(
      goal({ type: 'big_purchase', target: { estimate: { mode: 'range', low: 100_000, high: 140_000 }, currency: 'TWD' }, targetDate: '2027-10-22' }),
      ctx,
    );
    expect(p.monthsLeft).toBe(12);
    expect(p.requiredMonthly!.low).toBeLessThan(p.requiredMonthly!.mid);
    expect(p.requiredMonthly!.mid).toBeLessThan(p.requiredMonthly!.high);
    expect(p.requiredMonthly!.mid).toBeGreaterThan(9_000);
    expect(p.eta!.earliest!).toBeLessThanOrEqual(p.eta!.latest!);
  });

  it('retirement target is annual expense ÷ withdrawal rate', () => {
    const ctx = ctxFor({ expenses: [expense(50_000)] });
    expect(projectGoal(goal({ type: 'retirement_fi' }), ctx).target?.mid).toBe(15_000_000);
  });

  it('home down payment includes fees and checks the mortgage burden', () => {
    const ctx = ctxFor({ incomes: [income(100_000)] });
    const p = projectGoal(
      goal({
        type: 'home_down_payment',
        params: { kind: 'home_down_payment', homePrice: { estimate: { mode: 'exact', value: 10_000_000, asOf: today }, currency: 'TWD' }, downPaymentRatio: 0.2, feesRatio: 0.03 },
      }),
      ctx,
    );
    expect(p.target?.mid).toBe(2_300_000);
    expect(p.home?.loan.mid).toBe(8_000_000);
    expect(p.home?.incomeRatio?.mid).toBeGreaterThan(0.25);
  });

  it('debt payoff compares strategies', () => {
    const card = liability({ mode: 'exact', value: 50_000, asOf: today }, { id: 'c', category: 'credit_card', isRevolving: true });
    const loan = liability({ mode: 'exact', value: 300_000, asOf: today }, { id: 'p', category: 'personal_loan' });
    const ctx = ctxFor({ liabilities: [card, loan] });
    const p = projectGoal(
      goal({ type: 'debt_payoff', params: { kind: 'debt_payoff', liabilityIds: ['c', 'p'], strategy: 'avalanche' }, monthlyContribution: { estimate: { mode: 'exact', value: 3000, asOf: today }, currency: 'TWD' } }),
      ctx,
    );
    expect(p.target?.mid).toBe(350_000);
    expect(p.debt!.avalanche.totalInterest).toBeLessThanOrEqual(p.debt!.snowball.totalInterest);
    expect(p.eta?.expected).toBe(p.debt!.avalanche.months);
  });

  it('no contribution and no surplus means no ETA', () => {
    const ctx = ctxFor({ incomes: [income(30_000)], expenses: [expense(40_000)] });
    const p = projectGoal(goal({ target: { estimate: { mode: 'exact', value: 100_000, asOf: today }, currency: 'TWD' } }), ctx);
    expect(p.contributionSource).toBe('none');
    expect(p.eta).toBeNull();
  });
});
