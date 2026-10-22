import type { LocalePack } from '../model/localePack';
import type {
  Asset,
  Estimate,
  ExpenseItem,
  Household,
  ID,
  IncomeItem,
  ISODate,
  Liability,
  Range,
  Settings,
  Snapshot,
} from '../model/types';
import { computeBalanceSheet, type BalanceSheet, type ResolvedItem } from './balanceSheet';
import { monthlyExpense, monthlyIncome, type MonthlyTotal } from './cashflow';
import type { MoneyContext } from './currency';
import { resolveDebts, type ResolvedDebt } from './debt';
import { sub, sum } from './interval';
import { ladderPosition, type LadderPosition } from './ladder';
import { estimateWeight, isStale, precisionScore, type PrecisionResult } from './precision';

export interface FinancialData {
  household: Household;
  settings: Settings;
  assets: Asset[];
  liabilities: Liability[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
}

export interface RefinementTarget {
  kind: 'asset' | 'liability';
  id: ID;
  reason: 'unknown' | 'stale' | 'imprecise';
}

export interface Overview {
  balanceSheet: BalanceSheet;
  /** 資產負債表的精確度 */
  precision: PrecisionResult;
  ladder: LadderPosition;
  income: MonthlyTotal;
  /** 只含經常性收入（不含年終等一次性收入） */
  recurringIncome: MonthlyTotal;
  expense: MonthlyTotal;
  /** 只含必要支出 */
  essentialExpense: MonthlyTotal;
  debts: ResolvedDebt[];
  /** 每月貸款還款合計 */
  debtPayments: Range;
  /** 每月結餘 = 收入 − 支出 − 還款；收入或支出未知時為 null */
  surplus: Range | null;
  /** 最值得改精確的一項，沒有就是 null */
  nextRefinement: RefinementTarget | null;
}

export function moneyContext(data: FinancialData, pack: LocalePack): MoneyContext {
  return {
    statistics: pack.statistics,
    defaultTolerance: data.settings.defaultTolerance,
    baseCurrency: data.household.baseCurrency,
    fxRates: data.settings.fxRates,
  };
}

interface Candidate {
  kind: RefinementTarget['kind'];
  id: ID;
  estimate: Estimate;
  range: Range | null;
}

function candidates(bs: BalanceSheet): Candidate[] {
  const map = <T extends { id: ID }>(kind: Candidate['kind'], xs: ResolvedItem<T>[], est: (t: T) => Estimate) =>
    xs.map((x) => ({ kind, id: x.item.id, estimate: est(x.item), range: x.range }));
  return [
    ...map('asset', bs.assets, (a: Asset) => a.value.estimate),
    ...map('liability', bs.liabilities, (l: Liability) => l.balance.estimate),
  ];
}

/** 無法解析的項目最優先；其次是「金額 × 不確定程度」最大的項目 */
export function findNextRefinement(
  bs: BalanceSheet,
  opts: { today: ISODate; staleAfterDays: number },
): RefinementTarget | null {
  const cs = candidates(bs);
  const unresolved = cs.find((c) => c.range === null);
  if (unresolved) return { kind: unresolved.kind, id: unresolved.id, reason: 'unknown' };

  let best: { c: Candidate; score: number } | null = null;
  for (const c of cs) {
    const w = estimateWeight(c.estimate, opts);
    if (w >= 1) continue;
    const score = Math.abs(c.range!.mid) * (1 - w);
    if (!best || score > best.score) best = { c, score };
  }
  if (!best) return null;
  const reason = isStale(best.c.estimate, opts) ? 'stale' : best.c.estimate.mode === 'unknown' ? 'unknown' : 'imprecise';
  return { kind: best.c.kind, id: best.c.id, reason };
}

export function computeOverview(data: FinancialData, pack: LocalePack, today: ISODate): Overview {
  const ctx = moneyContext(data, pack);
  const bs = computeBalanceSheet(data.assets, data.liabilities, ctx);
  const opts = { today, staleAfterDays: data.settings.staleAfterDays };
  const precision = precisionScore(
    candidates(bs).map((c) => ({ estimate: c.estimate, magnitude: c.range ? Math.abs(c.range.mid) : null })),
    opts,
  );
  const income = monthlyIncome(data.incomes, ctx);
  const expense = monthlyExpense(data.expenses, ctx);
  const debts = resolveDebts(data.liabilities, ctx, pack);
  const debtPayments = sum(debts.map((d) => d.payment));
  return {
    balanceSheet: bs,
    precision,
    ladder: ladderPosition(bs.netWorth, pack.wealthLadder),
    income,
    recurringIncome: monthlyIncome(data.incomes, ctx, { recurringOnly: true }),
    expense,
    essentialExpense: monthlyExpense(
      data.expenses.filter((e) => e.essential),
      ctx,
    ),
    debts,
    debtPayments,
    surplus: income.total && expense.total ? sub(sub(income.total, expense.total), debtPayments) : null,
    nextRefinement: findNextRefinement(bs, opts),
  };
}

/** 建立快照內容（不含 id 與時間戳記） */
export function buildSnapshotData(
  data: FinancialData,
  overview: Overview,
  pack: LocalePack,
  date: ISODate,
  trigger: Snapshot['trigger'],
): Omit<Snapshot, 'id' | 'householdId' | 'createdAt' | 'updatedAt'> {
  const bs = overview.balanceSheet;
  return {
    date,
    trigger,
    baseCurrency: data.household.baseCurrency,
    summary: {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      netWorth: bs.netWorth,
      accessibleNetWorth: bs.accessibleNetWorth,
      monthlyIncome: overview.income.total ?? undefined,
      monthlyExpense: overview.expense.total ?? undefined,
      precision: overview.precision.score,
      ladderLevel: overview.ladder.level,
      byAssetCategory: bs.byAssetCategory,
      byLiabilityCategory: bs.byLiabilityCategory,
    },
    items: {
      assets: bs.assets.map(({ item: a }) => ({ id: a.id, category: a.category, label: a.label, value: a.value })),
      liabilities: bs.liabilities.map(({ item: l }) => ({
        id: l.id,
        category: l.category,
        label: l.label,
        balance: l.balance,
      })),
    },
    fxRates: data.settings.fxRates,
    localePackVersion: pack.version,
  };
}
