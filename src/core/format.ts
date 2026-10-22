import type { Range } from '../model/types';

export interface DisplayUnit {
  value: number;
  label: string;
}

function trimNumber(n: number, maxFractionDigits: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

/**
 * 以大數字單位精簡顯示，例如 1,234,567 → '123 萬'、56,000 → '5.6 萬'。
 * units 需由大到小排列；小於最小單位時顯示完整數字。
 */
export function formatCompact(n: number, units: DisplayUnit[]): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  for (const u of units) {
    if (abs >= u.value) {
      const v = abs / u.value;
      const digits = v >= 100 ? 0 : 1;
      return `${sign}${trimNumber(v, digits)} ${u.label}`;
    }
  }
  return `${sign}${trimNumber(abs, 0)}`;
}

export function formatPercent(v: number): string {
  const pct = v * 100;
  return `${trimNumber(pct, Math.abs(pct) < 10 ? 1 : 0)}%`;
}

export function formatPercentRange(r: Range): string {
  if (r.low === r.high) return formatPercent(r.mid);
  return `${formatPercent(r.low)} ～ ${formatPercent(r.high)}`;
}

export function formatRange(r: Range, units: DisplayUnit[]): string {
  if (r.low === r.high) return formatCompact(r.mid, units);
  return `${formatCompact(r.low, units)} ～ ${formatCompact(r.high, units)}`;
}

/**
 * 解析使用者輸入的金額，支援千分位與單位，例如 '600萬'、'1.2億'、'35k'、'1億2000萬'。
 * 無法解析時回傳 null。
 */
export function parseAmount(input: string, aliases: Record<string, number>): number | null {
  const s = input.replace(/[,\s，_]/g, '').toLowerCase();
  if (!s) return null;
  const unitKeys = Object.keys(aliases)
    .map((k) => k.toLowerCase())
    .sort((a, b) => b.length - a.length);
  const lowerAliases = Object.fromEntries(Object.entries(aliases).map(([k, v]) => [k.toLowerCase(), v]));

  let total = 0;
  let i = 0;
  let matchedAny = false;
  while (i < s.length) {
    const m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) return null;
    const num = Number(m[0]);
    i += m[0].length;
    const unit = unitKeys.find((u) => s.startsWith(u, i));
    if (unit) {
      total += num * lowerAliases[unit]!;
      i += unit.length;
    } else {
      // 沒有單位的數字只能出現在最後
      if (i !== s.length) return null;
      total += num;
    }
    matchedAny = true;
  }
  return matchedAny && Number.isFinite(total) ? total : null;
}
