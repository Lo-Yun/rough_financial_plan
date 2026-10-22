import type { Range } from '../model/types';

// 保守的區間算術（見規格 5.2）：low/high 代表最壞與最好的組合

export const ZERO: Range = { low: 0, mid: 0, high: 0 };

export function point(v: number): Range {
  return { low: v, mid: v, high: v };
}

export function add(a: Range, b: Range): Range {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export function sub(a: Range, b: Range): Range {
  return { low: a.low - b.high, mid: a.mid - b.mid, high: a.high - b.low };
}

export function sum(ranges: Iterable<Range>): Range {
  let acc = ZERO;
  for (const r of ranges) acc = add(acc, r);
  return acc;
}

export function scale(r: Range, k: number): Range {
  return k >= 0
    ? { low: r.low * k, mid: r.mid * k, high: r.high * k }
    : { low: r.high * k, mid: r.mid * k, high: r.low * k };
}

export function isPoint(r: Range): boolean {
  return r.low === r.high;
}

/** 區間相對寬度，相對於中間值；中間值為 0 時回傳 0 */
export function relativeWidth(r: Range): number {
  return r.mid === 0 ? 0 : (r.high - r.low) / Math.abs(r.mid);
}
