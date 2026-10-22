import type { HealthMetricKey, LocalePack, Threshold } from '../model/localePack';
import type { Asset, AssetCategory, ExpenseCategory, ExpenseItem, Range } from '../model/types';
import { monthlyExpense } from './cashflow';
import type { MoneyContext } from './currency';
import { add, div, scale, sub, point, sum, ZERO } from './interval';
import type { Overview } from './overview';

// 財務健檢，見規格 4.5

export type Light = 'red' | 'yellow' | 'green';

/** 指標無法計算的原因 */
export type MissingReason = 'no_income' | 'no_expense' | 'no_housing' | 'no_insurance';

export interface HealthMetric {
  key: HealthMetricKey;
  value: Range | null;
  light: Light | null;
  /** 估算範圍橫跨不同燈號 */
  spans: boolean;
  /** 範圍兩端的燈號，spans 時用來提示「可能是黃燈或綠燈」 */
  lightRange?: [Light, Light];
  note?: 'excellent' | 'too_high';
  missing?: MissingReason;
}

export interface HealthReport {
  metrics: HealthMetric[];
  /** 最該先處理的一項：依優先順序的第一個紅燈，沒有就取第一個黃燈 */
  top: HealthMetric | null;
  fi: {
    /** 財務自由目標金額 = 年支出 ÷ 安全提領率 */
    target: Range | null;
    /** 可投資資產（現金、投資、加密資產、退休帳戶） */
    investable: Range;
    progress: Range | null;
  };
}

/** 優先順序：先止血（高利債），再建立安全網，再談儲蓄與負債比 */
export const METRIC_PRIORITY: HealthMetricKey[] = [
  'high_interest_debt',
  'emergency_months',
  'savings_rate',
  'debt_service_ratio',
  'unsecured_debt_multiple',
  'housing_cost_ratio',
  'insurance_premium_ratio',
];

const INVESTABLE: AssetCategory[] = ['cash', 'investment', 'crypto', 'retirement'];

export function lightFor(v: number, th: Threshold): Light {
  if (th.better === 'higher') return v >= th.green ? 'green' : v >= th.yellow ? 'yellow' : 'red';
  return v <= th.green ? 'green' : v <= th.yellow ? 'yellow' : 'red';
}

function metric(key: HealthMetricKey, value: Range | null, th: Threshold, missing?: MissingReason): HealthMetric {
  if (!value) return { key, value: null, light: null, spans: false, missing };
  const light = lightFor(value.mid, th);
  const lo = lightFor(value.low, th);
  const hi = lightFor(value.high, th);
  let note: HealthMetric['note'];
  if (th.tooHigh !== undefined && value.mid > th.tooHigh) note = 'too_high';
  else if (th.excellent !== undefined && value.mid >= th.excellent) note = 'excellent';
  return { key, value, light, spans: lo !== hi, lightRange: lo !== hi ? [lo, hi] : undefined, note };
}

function assetSum(overview: Overview, pred: (a: Asset) => boolean): Range {
  return sum(overview.balanceSheet.assets.flatMap((r) => (r.range && pred(r.item) ? [r.range] : [])));
}

function expenseOf(expenses: ExpenseItem[], category: ExpenseCategory, ctx: MoneyContext): Range {
  return monthlyExpense(
    expenses.filter((e) => e.category === category),
    ctx,
  ).total ?? ZERO;
}

export function computeHealth(
  overview: Overview,
  expenses: ExpenseItem[],
  pack: LocalePack,
  ctx: MoneyContext,
  safeWithdrawalRate: number,
): HealthReport {
  const th = pack.healthThresholds;
  const income = overview.income.total;
  const recurring = overview.recurringIncome.total;
  const expense = overview.expense.total;
  const payments = overview.debtPayments;
  const debts = overview.debts;
  const noIncome = !income || income.mid <= 0;

  const outflow = expense ? add(expense, payments) : null;
  const liquid = assetSum(overview, (a) => a.liquidity === 'liquid');
  const mortgagePayments = sum(debts.filter((d) => d.liability.category === 'mortgage').map((d) => d.payment));
  const housing = add(expenseOf(expenses, 'housing', ctx), mortgagePayments);
  const insurance = expenseOf(expenses, 'insurance', ctx);
  const highInterest = sum(debts.filter((d) => d.isHighInterest).map((d) => d.balance));
  const unsecured = sum(debts.filter((d) => !d.liability.secured).map((d) => d.balance));

  const ratioOfIncome = (x: Range, base: Range | null) => (base ? div(x, base) : null);
  // 儲蓄率 = 1 − 流出 ÷ 收入。若用「結餘 ÷ 收入」，收入的不確定性會被算兩次，範圍會大到沒有意義
  const outflowShare = outflow && income ? div(outflow, income) : null;
  const savingsRate = outflowShare ? sub(point(1), outflowShare) : null;

  const metrics: HealthMetric[] = [
    metric(
      'savings_rate',
      savingsRate,
      th.savings_rate,
      noIncome ? 'no_income' : !expense ? 'no_expense' : undefined,
    ),
    metric('emergency_months', outflow ? div(liquid, outflow) : null, th.emergency_months, 'no_expense'),
    metric('debt_service_ratio', noIncome ? null : ratioOfIncome(payments, recurring ?? income), th.debt_service_ratio, 'no_income'),
    metric(
      'housing_cost_ratio',
      noIncome || housing.high <= 0 ? null : ratioOfIncome(housing, recurring ?? income),
      th.housing_cost_ratio,
      noIncome ? 'no_income' : 'no_housing',
    ),
    metric('high_interest_debt', highInterest, th.high_interest_debt),
    metric('unsecured_debt_multiple', noIncome ? null : ratioOfIncome(unsecured, recurring ?? income), th.unsecured_debt_multiple, 'no_income'),
    metric(
      'insurance_premium_ratio',
      noIncome || insurance.high <= 0 ? null : ratioOfIncome(insurance, income),
      th.insurance_premium_ratio,
      noIncome ? 'no_income' : 'no_insurance',
    ),
  ];

  const byPriority = METRIC_PRIORITY.map((k) => metrics.find((m) => m.key === k)!);
  const top = byPriority.find((m) => m.light === 'red') ?? byPriority.find((m) => m.light === 'yellow') ?? null;

  const investable = assetSum(overview, (a) => INVESTABLE.includes(a.category));
  const fiTarget = expense ? scale(expense, 12 / safeWithdrawalRate) : null;
  return {
    metrics,
    top,
    fi: {
      target: fiTarget,
      investable,
      progress: fiTarget ? div(investable, fiTarget) : null,
    },
  };
}
