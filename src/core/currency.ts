import type { CurrencyCode, FxRate, MoneyEstimate, Range } from '../model/types';
import { resolveEstimate, type EstimateContext } from './estimate';
import { scale } from './interval';

export interface MoneyContext extends EstimateContext {
  baseCurrency: CurrencyCode;
  fxRates: FxRate[];
}

export type MoneyResolution =
  | { status: 'ok'; range: Range }
  | { status: 'unknown' }
  | { status: 'missing_fx'; currency: CurrencyCode };

/** 金額估算 → 主要幣別的區間 */
export function resolveMoney(m: MoneyEstimate, ctx: MoneyContext): MoneyResolution {
  const range = resolveEstimate(m.estimate, ctx);
  if (!range) return { status: 'unknown' };
  if (m.currency === ctx.baseCurrency) return { status: 'ok', range };
  const fx = ctx.fxRates.find((r) => r.currency === m.currency);
  if (!fx || !(fx.rateToBase > 0)) return { status: 'missing_fx', currency: m.currency };
  return { status: 'ok', range: scale(range, fx.rateToBase) };
}
