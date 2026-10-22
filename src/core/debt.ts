import type { LocalePack } from '../model/localePack';
import type { ID, Liability, Range } from '../model/types';
import { resolveEstimate } from './estimate';
import { resolveMoney, type MoneyContext } from './currency';
import { point } from './interval';

/** 本息平均攤還的每月付款（年利率、期數為月） */
export function amortizedPayment(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = annualRate / 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - (1 + i) ** -months);
}

export interface ResolvedDebt {
  liability: Liability;
  balance: Range;
  /** 年利率 */
  rate: Range;
  /** 每月還款（主要幣別） */
  payment: Range;
  rateDerived: boolean;
  paymentDerived: boolean;
  isHighInterest: boolean;
}

/**
 * 解析負債的餘額、利率、每月還款。
 * 沒填利率時用地區資料包的預設值；沒填每月還款時，依餘額、利率、剩餘期數推算。
 * 每月全額繳清的信用卡帳單已算在支出裡，利率與還款都視為 0。
 */
export function resolveDebt(l: Liability, ctx: MoneyContext, pack: LocalePack): ResolvedDebt | null {
  const bal = resolveMoney(l.balance, ctx);
  if (bal.status !== 'ok') return null;
  const balance = bal.range;
  const def = pack.categories.liability.find((c) => c.key === l.category);

  if (l.category === 'credit_card' && !l.isRevolving) {
    return { liability: l, balance, rate: point(0), payment: point(0), rateDerived: false, paymentDerived: false, isHighInterest: false };
  }

  const userRate = l.annualRate ? resolveEstimate(l.annualRate, ctx) : null;
  const rate = userRate ?? point(def?.defaultAnnualRate ?? 0);

  let payment: Range | null = null;
  if (l.monthlyPayment) {
    const p = resolveMoney(l.monthlyPayment, ctx);
    if (p.status === 'ok') payment = p.range;
  }
  const paymentDerived = payment === null;
  if (!payment) {
    const months = (l.remainingMonths && resolveEstimate(l.remainingMonths, ctx)?.mid) || def?.defaultTermMonths || 60;
    const pay = (b: number) => amortizedPayment(b, rate.mid, months);
    payment = { low: pay(balance.low), mid: pay(balance.mid), high: pay(balance.high) };
  }

  const isHighInterest = (l.category === 'credit_card' && !!l.isRevolving) || rate.mid >= pack.highInterestRate;
  return { liability: l, balance, rate, payment, rateDerived: userRate === null, paymentDerived, isHighInterest };
}

export function resolveDebts(liabilities: Liability[], ctx: MoneyContext, pack: LocalePack): ResolvedDebt[] {
  return liabilities.filter((l) => !l.archivedAt).flatMap((l) => resolveDebt(l, ctx, pack) ?? []);
}

export interface PayoffDebt {
  id: ID;
  balance: number;
  annualRate: number;
  minPayment: number;
}

export interface PayoffResult {
  /** 全部還清所需月數；在上限內還不完時為 null */
  months: number | null;
  totalInterest: number;
  /** 每筆負債還清的月份，依還清順序 */
  order: { id: ID; month: number }[];
}

/**
 * 模擬還債。每月先付各筆的最低還款，剩下的預算（含已還清負債釋出的額度）集中還優先的那一筆。
 * avalanche（雪崩法）：利率最高的優先，利息最省。snowball（雪球法）：餘額最小的優先，最快有成就感。
 */
export function simulatePayoff(
  debts: PayoffDebt[],
  extraMonthly: number,
  strategy: 'avalanche' | 'snowball',
  maxMonths = 600,
): PayoffResult {
  const state = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const budget = state.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, extraMonthly);
  const order: PayoffResult['order'] = [];
  let totalInterest = 0;

  for (let month = 1; month <= maxMonths; month++) {
    const open = state.filter((d) => d.balance > 0);
    if (open.length === 0) return { months: month - 1, totalInterest, order };

    for (const d of open) {
      const interest = (d.balance * d.annualRate) / 12;
      d.balance += interest;
      totalInterest += interest;
    }

    let left = budget;
    for (const d of open) {
      const pay = Math.min(d.balance, d.minPayment, left);
      d.balance -= pay;
      left -= pay;
    }

    const priority = [...open].sort((a, b) =>
      strategy === 'avalanche' ? b.annualRate - a.annualRate || a.balance - b.balance : a.balance - b.balance || b.annualRate - a.annualRate,
    );
    for (const d of priority) {
      if (left <= 0) break;
      const pay = Math.min(d.balance, left);
      d.balance -= pay;
      left -= pay;
    }

    for (const d of open) {
      if (d.balance <= 0.005) {
        d.balance = 0;
        order.push({ id: d.id, month });
      }
    }
  }
  return state.every((d) => d.balance <= 0) ? { months: maxMonths, totalInterest, order } : { months: null, totalInterest, order };
}
