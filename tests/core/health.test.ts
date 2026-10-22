import { describe, expect, it } from 'vitest';
import { computeHealth, lightFor } from '../../src/core/health';
import { computeOverview, moneyContext, type FinancialData } from '../../src/core/overview';
import { twPack } from '../../src/locales/tw/pack';
import type { ExpenseItem, IncomeItem } from '../../src/model/types';
import { asset, household, liability, settings } from '../helpers';

const today = '2026-10-22';
const stamp = '2026-01-01T00:00:00Z';
const th = twPack.healthThresholds;

function income(e: IncomeItem['amount']['estimate']): IncomeItem {
  return { id: 'i', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'salary', amount: { estimate: e, currency: 'TWD' }, frequency: 'monthly', isRecurring: true, basis: 'net' };
}
function expense(value: number, category = 'other'): ExpenseItem {
  return { id: `e${category}`, householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category, amount: { estimate: { mode: 'exact', value, asOf: today }, currency: 'TWD' }, frequency: 'monthly', essential: true };
}
const exact = (value: number) => ({ mode: 'exact' as const, value, asOf: today });

function health(d: Partial<FinancialData>) {
  const data: FinancialData = { household, settings, assets: [], liabilities: [], incomes: [], expenses: [], ...d };
  const o = computeOverview(data, twPack, today);
  return computeHealth(o, data.expenses, twPack, moneyContext(data, twPack), 0.04);
}
const m = (r: ReturnType<typeof health>, key: string) => r.metrics.find((x) => x.key === key)!;

describe('lightFor', () => {
  it('higher-is-better and lower-is-better', () => {
    expect(lightFor(0.15, th.savings_rate)).toBe('green');
    expect(lightFor(0.05, th.savings_rate)).toBe('yellow');
    expect(lightFor(-0.01, th.savings_rate)).toBe('red');
    expect(lightFor(0.25, th.debt_service_ratio)).toBe('green');
    expect(lightFor(0.35, th.debt_service_ratio)).toBe('yellow');
    expect(lightFor(0.5, th.debt_service_ratio)).toBe('red');
    expect(lightFor(0, th.high_interest_debt)).toBe('green');
    expect(lightFor(1, th.high_interest_debt)).toBe('red');
  });
});

describe('computeHealth', () => {
  it('healthy household is all green and has no top issue', () => {
    const r = health({
      incomes: [income(exact(80_000))],
      expenses: [expense(40_000), expense(15_000, 'housing'), expense(3_000, 'insurance')],
      assets: [asset(exact(300_000))],
    });
    expect(m(r, 'savings_rate').light).toBe('green');
    expect(m(r, 'emergency_months').value?.mid).toBeCloseTo(300_000 / 58_000);
    expect(m(r, 'emergency_months').light).toBe('green');
    expect(m(r, 'housing_cost_ratio').light).toBe('green');
    expect(m(r, 'high_interest_debt').light).toBe('green');
    expect(r.top).toBeNull();
  });

  it('revolving card debt is the top issue', () => {
    const r = health({
      incomes: [income(exact(50_000))],
      expenses: [expense(48_000)],
      assets: [asset(exact(10_000))],
      liabilities: [liability(exact(80_000), { category: 'credit_card', isRevolving: true })],
    });
    expect(m(r, 'high_interest_debt').light).toBe('red');
    expect(r.top?.key).toBe('high_interest_debt');
    expect(m(r, 'savings_rate').light).toBe('red');
  });

  it('missing income makes ratio metrics unavailable', () => {
    const r = health({ expenses: [expense(30_000)] });
    expect(m(r, 'savings_rate').missing).toBe('no_income');
    expect(m(r, 'debt_service_ratio').value).toBeNull();
    expect(m(r, 'emergency_months').value?.mid).toBe(0);
  });

  it('insurance ratio needs an insurance expense', () => {
    const r = health({ incomes: [income(exact(50_000))], expenses: [expense(30_000)] });
    expect(m(r, 'insurance_premium_ratio').missing).toBe('no_insurance');
    expect(m(r, 'insurance_premium_ratio').light).toBeNull();
  });

  it('flags when a range spans two lights', () => {
    const r = health({ incomes: [income({ mode: 'range', low: 40_000, high: 80_000 })], expenses: [expense(50_000)] });
    const s = m(r, 'savings_rate');
    expect(s.spans).toBe(true);
    expect(s.lightRange).toEqual(['red', 'green']);
    // 1 − 5 萬 ÷ (4～8 萬)：-25% ～ 37.5%，收入的不確定性只算一次
    expect(s.value!.low).toBeCloseTo(-0.25);
    expect(s.value!.high).toBeCloseTo(0.375);
  });

  it('mortgage payment counts as housing cost and emergency fund note', () => {
    const r = health({
      incomes: [income(exact(60_000))],
      expenses: [expense(20_000)],
      assets: [asset(exact(2_000_000))],
      liabilities: [liability(exact(8_000_000), { category: 'mortgage', secured: true })],
    });
    expect(m(r, 'housing_cost_ratio').value!.mid).toBeGreaterThan(0.6);
    expect(m(r, 'housing_cost_ratio').light).toBe('red');
    expect(m(r, 'emergency_months').note).toBe('too_high');
  });

  it('FI progress', () => {
    const r = health({ expenses: [expense(50_000)], assets: [asset(exact(3_000_000), { category: 'investment', liquidity: 'semi_liquid' })] });
    expect(r.fi.target?.mid).toBe(15_000_000);
    expect(r.fi.progress?.mid).toBeCloseTo(0.2);
  });
});
