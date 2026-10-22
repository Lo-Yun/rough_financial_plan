import { describe, expect, it } from 'vitest';
import { computeAdvice } from '../../src/core/advice';
import { computeOverview, type FinancialData } from '../../src/core/overview';
import { resolveAssumptions } from '../../src/core/planning';
import { buildActionBoard, evalCondition, evalExpression, evaluateRules, MAX_ACTIVE } from '../../src/core/rules';
import { twPack } from '../../src/locales/tw/pack';
import type { ExpenseItem, IncomeItem, UserAction } from '../../src/model/types';
import { asset, household, liability, settings } from '../helpers';

const today = '2026-10-22';
const stamp = '2026-01-01T00:00:00Z';
const exact = (value: number) => ({ mode: 'exact' as const, value, asOf: today });

describe('evalCondition', () => {
  const m = { a: 5, b: true, n: null };
  it('compares numbers and booleans', () => {
    expect(evalCondition({ metric: 'a', op: '>', value: 3 }, m)).toBe(true);
    expect(evalCondition({ metric: 'a', op: '<=', value: 4 }, m)).toBe(false);
    expect(evalCondition({ metric: 'b', op: '==', value: true }, m)).toBe(true);
  });
  it('null metrics fail comparisons but satisfy missing', () => {
    expect(evalCondition({ metric: 'n', op: '<', value: 1 }, m)).toBe(false);
    expect(evalCondition({ not: { metric: 'n', op: '<', value: 1 } }, m)).toBe(true);
    expect(evalCondition({ missing: 'n' }, m)).toBe(true);
    expect(evalCondition({ missing: 'a' }, m)).toBe(false);
    expect(evalCondition({ missing: 'nope' }, m)).toBe(true);
  });
  it('combines with all / any', () => {
    expect(evalCondition({ all: [{ metric: 'a', op: '>', value: 1 }, { metric: 'b', op: '==', value: true }] }, m)).toBe(true);
    expect(evalCondition({ any: [{ metric: 'a', op: '>', value: 9 }, { missing: 'n' }] }, m)).toBe(true);
  });
});

describe('evalExpression', () => {
  it('computes and rounds to thousands', () => {
    expect(evalExpression({ op: 'round', args: [{ op: '*', args: [{ metric: 'x' }, { const: 3 }] }] }, { x: 12_345 })).toBe(37_000);
    expect(evalExpression({ op: '-', args: [{ const: 10 }, { const: 3 }] }, {})).toBe(7);
    expect(evalExpression({ metric: 'missing' }, {})).toBeNull();
    expect(evalExpression({ op: '/', args: [{ const: 1 }, { const: 0 }] }, {})).toBeNull();
  });
});

describe('locale pack rules', () => {
  it('every rule points to an existing template', () => {
    const ids = new Set(twPack.actionTemplates.map((t) => t.id));
    expect(twPack.actionRules.filter((r) => !ids.has(r.templateId))).toEqual([]);
  });
});

function action(a: Partial<UserAction>): UserAction {
  return { id: Math.random().toString(36), householdId: 'h', createdAt: stamp, updatedAt: stamp, status: 'active', ...a };
}

describe('buildActionBoard', () => {
  const suggestions = evaluateRules(twPack, { 'debt.revolving_total': 50_000, 'health.emergency_months': 0.5, 'cashflow.monthly_outflow': 40_000, 'cashflow.income': 50_000 });

  it('suggests in priority order with params', () => {
    expect(suggestions.map((s) => s.template.id)).toEqual(['pay_off_revolving', 'starter_emergency_fund']);
    expect(suggestions[1]!.params.target).toBe(40_000);
  });

  it('hides active, done (cooldown), permanently dismissed and snoozed suggestions', () => {
    const board = buildActionBoard(twPack, suggestions, [action({ templateId: 'pay_off_revolving' })], today);
    expect(board.active).toHaveLength(1);
    expect(board.active[0]!.maybeDone).toBe(false);
    expect(board.suggestions.map((s) => s.template.id)).toEqual(['starter_emergency_fund']);

    const snoozed = buildActionBoard(twPack, suggestions, [action({ templateId: 'starter_emergency_fund', status: 'dismissed', dismissReason: 'later', dismissedAt: '2026-10-01T00:00:00Z' })], today);
    expect(snoozed.suggestions.map((s) => s.template.id)).toEqual(['pay_off_revolving']);
    const snoozeOver = buildActionBoard(twPack, suggestions, [action({ templateId: 'starter_emergency_fund', status: 'dismissed', dismissReason: 'later', dismissedAt: '2026-08-01T00:00:00Z' })], today);
    expect(snoozeOver.suggestions).toHaveLength(2);

    const doneLongAgo = buildActionBoard(twPack, suggestions, [action({ templateId: 'pay_off_revolving', status: 'done', completedAt: '2026-01-01T00:00:00Z' })], today);
    expect(doneLongAgo.suggestions).toHaveLength(2);
    expect(doneLongAgo.done).toHaveLength(1);
  });

  it('flags active actions whose condition no longer holds, and caps active count', () => {
    const board = buildActionBoard(twPack, [], [action({ templateId: 'pay_off_revolving' }), action({ title: '自訂' }), action({ title: 'b' })], today);
    expect(board.active.find((a) => a.action.templateId)!.maybeDone).toBe(true);
    expect(board.active.find((a) => a.action.title === '自訂')!.maybeDone).toBe(false);
    expect(board.canAcceptMore).toBe(board.active.length < MAX_ACTIVE);
    expect(board.canAcceptMore).toBe(false);
  });
});

function income(value: number): IncomeItem {
  return { id: 'i', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'salary', amount: { estimate: exact(value), currency: 'TWD' }, frequency: 'monthly', isRecurring: true, basis: 'net' };
}
function expense(value: number): ExpenseItem {
  return { id: 'e', householdId: 'h', createdAt: stamp, updatedAt: stamp, ownerId: 'joint', category: 'other', amount: { estimate: exact(value), currency: 'TWD' }, frequency: 'monthly', essential: true };
}

function advice(d: Partial<FinancialData>, actions: UserAction[] = []) {
  const data: FinancialData = { household, settings, assets: [], liabilities: [], incomes: [], expenses: [], ...d };
  const overview = computeOverview(data, twPack, today);
  return computeAdvice({
    data,
    overview,
    pack: twPack,
    goals: [],
    holdings: [],
    assumptions: resolveAssumptions(undefined, twPack),
    age: 35,
    snapshotCount: 1,
    actions,
    today,
  });
}
const ids = (a: ReturnType<typeof advice>) => a.suggestions.map((s) => s.template.id);

describe('computeAdvice scenarios', () => {
  it('card debt and no savings: stop the bleeding first', () => {
    const a = advice({
      incomes: [income(45_000)],
      expenses: [expense(40_000)],
      assets: [asset(exact(10_000))],
      liabilities: [liability(exact(60_000), { category: 'credit_card', isRevolving: true })],
    });
    expect(ids(a).slice(0, 2)).toEqual(['pay_off_revolving', 'starter_emergency_fund']);
    expect(a.metrics['debt.revolving_total']).toBe(60_000);
    expect(ids(a)).not.toContain('learn_index_investing');
  });

  it('safe L2 saver with no investments: learn index investing', () => {
    const a = advice({ incomes: [income(80_000)], expenses: [expense(40_000)], assets: [asset(exact(500_000))] });
    expect(a.metrics['ladder.level']).toBe(2);
    expect(ids(a)).toContain('learn_index_investing');
    expect(ids(a)).toContain('grow_income');
    expect(ids(a)).not.toContain('starter_emergency_fund');
  });

  it('L3 gets lifestyle creep reminder; missing income asks for it', () => {
    const l3 = advice({ incomes: [income(150_000)], expenses: [expense(60_000)], assets: [asset(exact(5_000_000))] });
    expect(ids(l3)).toContain('avoid_lifestyle_creep');
    const noIncome = advice({ expenses: [expense(30_000)], assets: [asset(exact(100_000))] });
    expect(ids(noIncome)).toContain('add_income');
  });
});
