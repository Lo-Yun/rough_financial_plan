import type { Estimate, EstimateMode, ISODate } from '../model/types';
import { daysBetween } from './date';

// 見規格 5.3
export const MODE_WEIGHT: Record<EstimateMode, number> = {
  unknown: 0,
  range: 0.4,
  approx: 0.75,
  exact: 1,
};

export interface PrecisionOptions {
  today: ISODate;
  staleAfterDays: number;
}

export function isStale(e: Estimate, opts: PrecisionOptions): boolean {
  return e.mode === 'exact' && daysBetween(e.asOf, opts.today) > opts.staleAfterDays;
}

/** 單一估算值的權重，精確值過期時降為「大約」 */
export function estimateWeight(e: Estimate, opts: PrecisionOptions): number {
  return isStale(e, opts) ? MODE_WEIGHT.approx : MODE_WEIGHT[e.mode];
}

export interface PrecisionInput {
  estimate: Estimate;
  /** 主要幣別的中間值絕對值；無法解析時為 null */
  magnitude: number | null;
}

export interface PrecisionResult {
  /** 0–1 */
  score: number;
  /** 無法解析（不知道且沒有統計值，或缺匯率）的項目數 */
  unresolvedCount: number;
  staleCount: number;
  counts: Record<EstimateMode, number>;
}

/**
 * 依金額加權的精確度。
 * 無法解析的項目沒有金額，以其他項目的中位數金額當作它的份量，避免「填不知道」反而不影響分數。
 */
export function precisionScore(items: PrecisionInput[], opts: PrecisionOptions): PrecisionResult {
  const counts: Record<EstimateMode, number> = { unknown: 0, range: 0, approx: 0, exact: 0 };
  let staleCount = 0;
  const known: { m: number; w: number }[] = [];
  let unresolvedCount = 0;

  for (const it of items) {
    counts[it.estimate.mode]++;
    if (isStale(it.estimate, opts)) staleCount++;
    if (it.magnitude === null) unresolvedCount++;
    else known.push({ m: Math.abs(it.magnitude), w: estimateWeight(it.estimate, opts) });
  }

  const sorted = known.map((k) => k.m).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : 0;

  let num = 0;
  let den = 0;
  for (const k of known) {
    num += k.m * k.w;
    den += k.m;
  }
  den += unresolvedCount * median;

  const score = den > 0 ? num / den : items.length === 0 ? 0 : average(items.map((i) => estimateWeight(i.estimate, opts)));
  return { score, unresolvedCount, staleCount, counts };
}

function average(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
