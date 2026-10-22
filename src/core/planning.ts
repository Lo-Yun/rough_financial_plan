import type { LocalePack } from '../model/localePack';
import type { Assumptions, Asset, AssetCategory, Goal, GoalType, ISODate, Range, ReturnProfile } from '../model/types';
import { resolveMoney, type MoneyContext } from './currency';
import { amortizedPayment, simulatePayoff, type PayoffResult } from './debt';
import { div, scale, sub, sum, ZERO } from './interval';
import type { Overview } from './overview';

// 理財目標試算，見規格 4.6。所有金額都是「今天的幣值」，報酬率一律用扣除通膨的實質報酬。

export type Scenario = 'conservative' | 'neutral' | 'optimistic';

export interface ResolvedAssumptions {
  inflation: number;
  nominalReturn: Record<ReturnProfile, number>;
  scenarioSpread: number;
  safeWithdrawalRate: number;
}

export function resolveAssumptions(a: Assumptions | undefined, pack: LocalePack): ResolvedAssumptions {
  const d = pack.defaultAssumptions;
  return {
    inflation: a?.inflation ?? d.inflation,
    nominalReturn: { ...d.nominalReturn, ...a?.nominalReturn },
    scenarioSpread: a?.scenarioSpread ?? d.scenarioSpread,
    safeWithdrawalRate: a?.safeWithdrawalRate ?? d.safeWithdrawalRate,
  };
}

export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

export function monthlyRate(annual: number): number {
  return (1 + annual) ** (1 / 12) - 1;
}

/** 三種情境的實質年報酬；現金類波動小，只用四分之一的差距 */
export function scenarioRates(profile: ReturnProfile, a: ResolvedAssumptions): Record<Scenario, number> {
  const nominal = a.nominalReturn[profile];
  const spread = profile === 'cash' ? a.scenarioSpread / 4 : a.scenarioSpread;
  return {
    conservative: realRate(nominal - spread, a.inflation),
    neutral: realRate(nominal, a.inflation),
    optimistic: realRate(nominal + spread, a.inflation),
  };
}

/** 現值 pv、每月投入 pmt、月利率 i，n 個月後的終值 */
export function futureValue(pv: number, pmt: number, i: number, n: number): number {
  if (i === 0) return pv + pmt * n;
  const g = (1 + i) ** n;
  return pv * g + (pmt * (g - 1)) / i;
}

/** n 個月內從 current 存到 target 每月需要投入多少；已達成時為 0 */
export function requiredMonthly(target: number, current: number, i: number, n: number): number {
  if (n <= 0) return Math.max(0, target - current);
  if (i === 0) return Math.max(0, (target - current) / n);
  const g = (1 + i) ** n;
  return Math.max(0, ((target - current * g) * i) / (g - 1));
}

/** 每月投入 pmt 時，需要幾個月才會達到 target；永遠達不到時為 null */
export function monthsToTarget(target: number, current: number, pmt: number, i: number): number | null {
  if (current >= target) return 0;
  if (i === 0) return pmt > 0 ? Math.ceil((target - current) / pmt) : null;
  const num = target * i + pmt;
  const den = current * i + pmt;
  if (den <= 0 || num / den <= 0) return null;
  const n = Math.log(num / den) / Math.log(1 + i);
  // 減去極小值，避免浮點誤差讓剛好整數的月數多進位一個月
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n - 1e-9) : null;
}

/** 兩個日期之間的整月數（不足一個月不算） */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

export const DEFAULT_RETURN_PROFILE: Record<GoalType, ReturnProfile> = {
  emergency_fund: 'cash',
  debt_payoff: 'cash',
  home_down_payment: 'balanced',
  retirement_fi: 'growth',
  education: 'balanced',
  big_purchase: 'cash',
  custom: 'balanced',
};

/** 這些類型可以由系統自動算出目標金額 */
export const AUTO_TARGET_TYPES: GoalType[] = ['emergency_fund', 'retirement_fi', 'home_down_payment', 'debt_payoff'];

const FI_ASSETS: AssetCategory[] = ['cash', 'investment', 'crypto', 'retirement'];

export interface PlanningContext {
  overview: Overview;
  money: MoneyContext;
  assumptions: ResolvedAssumptions;
  pack: LocalePack;
  today: ISODate;
}

export interface HomeCheck {
  loan: Range;
  monthlyPayment: Range;
  /** 房貸月付 ÷ 經常性月收入 */
  incomeRatio: Range | null;
}

export interface DebtPlan {
  totalBalance: Range;
  minPayments: number;
  avalanche: PayoffResult;
  snowball: PayoffResult;
}

export interface GoalProjection {
  target: Range | null;
  current: Range;
  progress: number | null;
  reached: boolean;
  contribution: number | null;
  contributionSource: 'user' | 'surplus' | 'none';
  /** 有目標日期時：每月需要投入多少（樂觀～保守） */
  requiredMonthly: Range | null;
  monthsLeft: number | null;
  /** 照目前投入速度，幾個月後達成；null 代表照目前速度達不到 */
  eta: { earliest: number | null; expected: number | null; latest: number | null } | null;
  home?: HomeCheck;
  debt?: DebtPlan;
}

function goalTarget(goal: Goal, ctx: PlanningContext): Range | null {
  if (goal.target) {
    const r = resolveMoney(goal.target, ctx.money);
    return r.status === 'ok' ? r.range : null;
  }
  const o = ctx.overview;
  const p = goal.params;
  switch (goal.type) {
    case 'emergency_fund': {
      const months = p?.kind === 'emergency_fund' ? p.months : 6;
      const base = o.essentialExpense.total ?? o.expense.total;
      return base ? scale(sum([base, o.debtPayments]), months) : null;
    }
    case 'retirement_fi': {
      const swr = (p?.kind === 'retirement_fi' && p.withdrawalRate) || ctx.assumptions.safeWithdrawalRate;
      return o.expense.total ? scale(o.expense.total, 12 / swr) : null;
    }
    case 'home_down_payment': {
      if (p?.kind !== 'home_down_payment') return null;
      const price = resolveMoney(p.homePrice, ctx.money);
      return price.status === 'ok' ? scale(price.range, p.downPaymentRatio + p.feesRatio) : null;
    }
    case 'debt_payoff': {
      if (p?.kind !== 'debt_payoff') return null;
      return sum(o.debts.filter((d) => p.liabilityIds.includes(d.liability.id)).map((d) => d.balance));
    }
    default:
      return null;
  }
}

function goalCurrent(goal: Goal, ctx: PlanningContext): Range {
  const assets = ctx.overview.balanceSheet.assets;
  if (goal.linkedAssets?.length) {
    return sum(
      goal.linkedAssets.flatMap((l) => {
        const r = assets.find((a) => a.item.id === l.assetId)?.range;
        return r ? [scale(r, l.share)] : [];
      }),
    );
  }
  const pick = (pred: (a: Asset) => boolean) => sum(assets.flatMap((a) => (a.range && pred(a.item) ? [a.range] : [])));
  if (goal.type === 'emergency_fund') return pick((a) => a.liquidity === 'liquid');
  if (goal.type === 'retirement_fi') return pick((a) => FI_ASSETS.includes(a.category));
  return ZERO;
}

function homeCheck(goal: Goal, ctx: PlanningContext): HomeCheck | undefined {
  const p = goal.params;
  if (p?.kind !== 'home_down_payment') return undefined;
  const price = resolveMoney(p.homePrice, ctx.money);
  if (price.status !== 'ok') return undefined;
  const loan = scale(price.range, 1 - p.downPaymentRatio);
  const rate = ctx.pack.categories.liability.find((c) => c.key === 'mortgage')?.defaultAnnualRate ?? 0.02;
  const n = ctx.pack.homeDefaults.mortgageTermMonths;
  const pay = (x: number) => amortizedPayment(x, rate, n);
  const monthlyPayment = { low: pay(loan.low), mid: pay(loan.mid), high: pay(loan.high) };
  const income = ctx.overview.recurringIncome.total ?? ctx.overview.income.total;
  return { loan, monthlyPayment, incomeRatio: income ? div(monthlyPayment, income) : null };
}

function debtPlan(goal: Goal, ctx: PlanningContext, extra: number): DebtPlan | undefined {
  const p = goal.params;
  if (p?.kind !== 'debt_payoff') return undefined;
  const debts = ctx.overview.debts.filter((d) => p.liabilityIds.includes(d.liability.id));
  const input = debts.map((d) => ({
    id: d.liability.id,
    balance: d.balance.mid,
    annualRate: d.rate.mid,
    minPayment: d.payment.mid,
  }));
  return {
    totalBalance: sum(debts.map((d) => d.balance)),
    minPayments: input.reduce((s, d) => s + d.minPayment, 0),
    avalanche: simulatePayoff(input, extra, 'avalanche'),
    snowball: simulatePayoff(input, extra, 'snowball'),
  };
}

export function projectGoal(goal: Goal, ctx: PlanningContext): GoalProjection {
  const target = goalTarget(goal, ctx);
  const current = goalCurrent(goal, ctx);

  let contribution: number | null = null;
  let contributionSource: GoalProjection['contributionSource'] = 'none';
  if (goal.monthlyContribution) {
    const r = resolveMoney(goal.monthlyContribution, ctx.money);
    if (r.status === 'ok') {
      contribution = r.range.mid;
      contributionSource = 'user';
    }
  }
  if (contribution === null && goal.type !== 'debt_payoff' && ctx.overview.surplus && ctx.overview.surplus.mid > 0) {
    contribution = ctx.overview.surplus.mid;
    contributionSource = 'surplus';
  }

  if (goal.type === 'debt_payoff') {
    const debt = debtPlan(goal, ctx, contribution ?? 0);
    const strategy = goal.params?.kind === 'debt_payoff' ? goal.params.strategy : 'avalanche';
    const months = debt ? debt[strategy].months : null;
    return {
      target,
      current: ZERO,
      progress: null,
      reached: !!target && target.high <= 0,
      contribution,
      contributionSource,
      requiredMonthly: null,
      monthsLeft: goal.targetDate ? monthsBetween(ctx.today, goal.targetDate) : null,
      eta: debt ? { earliest: months, expected: months, latest: months } : null,
      debt,
    };
  }

  const rates = scenarioRates(goal.returnProfile ?? DEFAULT_RETURN_PROFILE[goal.type], ctx.assumptions);
  const i = { conservative: monthlyRate(rates.conservative), neutral: monthlyRate(rates.neutral), optimistic: monthlyRate(rates.optimistic) };
  const reached = !!target && current.mid >= target.mid;
  const monthsLeft = goal.targetDate ? monthsBetween(ctx.today, goal.targetDate) : null;

  let requiredMonthlyRange: Range | null = null;
  if (target && monthsLeft !== null && monthsLeft > 0) {
    requiredMonthlyRange = {
      low: requiredMonthly(target.low, current.high, i.optimistic, monthsLeft),
      mid: requiredMonthly(target.mid, current.mid, i.neutral, monthsLeft),
      high: requiredMonthly(target.high, current.low, i.conservative, monthsLeft),
    };
  }

  const eta =
    target && contribution !== null
      ? {
          earliest: monthsToTarget(target.low, current.high, contribution, i.optimistic),
          expected: monthsToTarget(target.mid, current.mid, contribution, i.neutral),
          latest: monthsToTarget(target.high, current.low, contribution, i.conservative),
        }
      : null;

  return {
    target,
    current,
    progress: target && target.mid > 0 ? Math.min(1, Math.max(0, current.mid / target.mid)) : null,
    reached,
    contribution,
    contributionSource,
    requiredMonthly: requiredMonthlyRange,
    monthsLeft,
    eta,
    home: homeCheck(goal, ctx),
  };
}

/** 尚差多少 */
export function remaining(p: GoalProjection): Range | null {
  return p.target ? sub(p.target, p.current) : null;
}
