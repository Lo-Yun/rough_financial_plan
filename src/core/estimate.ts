import type { StatEntry } from '../model/localePack';
import type { Estimate, EstimateMode, ISODate, Range } from '../model/types';

export interface EstimateContext {
  statistics: Record<string, StatEntry>;
  /** 「大約」模式的預設相對誤差，例如 0.15 */
  defaultTolerance: number;
}

/**
 * 估算值 → 區間（見規格 5.1）。
 * 「不知道」且沒有對應統計值時回傳 null，代表此項目不納入計算。
 */
export function resolveEstimate(e: Estimate, ctx: EstimateContext): Range | null {
  switch (e.mode) {
    case 'unknown': {
      const stat = e.statKey ? ctx.statistics[e.statKey] : undefined;
      return stat ? { low: stat.p25, mid: stat.p50, high: stat.p75 } : null;
    }
    case 'range': {
      const low = Math.min(e.low, e.high);
      const high = Math.max(e.low, e.high);
      return { low, mid: (low + high) / 2, high };
    }
    case 'approx': {
      const t = Math.max(0, e.tolerance ?? ctx.defaultTolerance);
      const a = e.value * (1 - t);
      const b = e.value * (1 + t);
      return { low: Math.min(a, b), mid: e.value, high: Math.max(a, b) };
    }
    case 'exact':
      return { low: e.value, mid: e.value, high: e.value };
  }
}

/** 估算值的代表數字（不含統計值），用於模式切換時沿用 */
function representativeValue(e: Estimate): number | undefined {
  switch (e.mode) {
    case 'unknown':
      return undefined;
    case 'range':
      return (e.low + e.high) / 2;
    case 'approx':
    case 'exact':
      return e.value;
  }
}

/** 切換估算模式，盡量保留原本的數字 */
export function convertEstimate(
  e: Estimate,
  to: EstimateMode,
  ctx: EstimateContext,
  today: ISODate,
): Estimate {
  if (e.mode === to) return e;
  const resolved = resolveEstimate(e, ctx);
  const v = representativeValue(e) ?? resolved?.mid;
  switch (to) {
    case 'unknown':
      return { mode: 'unknown' };
    case 'range':
      if (resolved) return { mode: 'range', low: resolved.low, high: resolved.high };
      return { mode: 'range', low: 0, high: 0 };
    case 'approx':
      return { mode: 'approx', value: v ?? 0 };
    case 'exact':
      return { mode: 'exact', value: v ?? 0, asOf: today, source: 'manual' };
  }
}

/** 「不知道」模式填上統計值 key；未提供 key 時保留原本的 */
export function withStatKey(e: Estimate, statKey: string | undefined): Estimate {
  return e.mode === 'unknown' && statKey !== undefined ? { ...e, statKey } : e;
}

/** 使用者沒有輸入任何值（範圍上限為 0、數值為 0）時，視為「不知道」 */
export function blankToUnknown(e: Estimate, statKey?: string): Estimate {
  const blank =
    (e.mode === 'range' && e.high <= 0) || ((e.mode === 'approx' || e.mode === 'exact') && !(e.value > 0));
  return blank ? { mode: 'unknown', statKey } : withStatKey(e, statKey);
}
