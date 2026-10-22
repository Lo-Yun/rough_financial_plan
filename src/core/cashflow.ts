import type { ExpenseItem, Frequency, IncomeItem, MoneyEstimate, Range } from '../model/types';
import { resolveMoney, type MoneyContext } from './currency';
import { scale, sum } from './interval';

// 見規格 5.4
const PER_MONTH: Record<Frequency, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function toMonthly(r: Range, f: Frequency): Range {
  return scale(r, PER_MONTH[f]);
}

interface Flow {
  amount: MoneyEstimate;
  frequency: Frequency;
  archivedAt?: string;
}

export interface MonthlyTotal {
  /** 所有可解析項目的月合計；沒有任何可解析項目時為 null */
  total: Range | null;
  unresolvedCount: number;
}

function monthlyTotal(items: Flow[], ctx: MoneyContext): MonthlyTotal {
  const ranges: Range[] = [];
  let unresolvedCount = 0;
  for (const it of items) {
    if (it.archivedAt) continue;
    const r = resolveMoney(it.amount, ctx);
    if (r.status === 'ok') ranges.push(toMonthly(r.range, it.frequency));
    else unresolvedCount++;
  }
  return { total: ranges.length ? sum(ranges) : null, unresolvedCount };
}

/** 月收入；recurringOnly 時排除年終等一次性收入（緊急預備金用） */
export function monthlyIncome(
  items: IncomeItem[],
  ctx: MoneyContext,
  opts: { recurringOnly?: boolean } = {},
): MonthlyTotal {
  return monthlyTotal(opts.recurringOnly ? items.filter((i) => i.isRecurring) : items, ctx);
}

export function monthlyExpense(items: ExpenseItem[], ctx: MoneyContext): MonthlyTotal {
  return monthlyTotal(items, ctx);
}
