/**
 * 折線圖用的純函式：座標換算與刻度。手寫 SVG 圖表（`components/LineChart.tsx`）使用，
 * 不依賴 React，方便測試。
 */

export interface LinearScale {
  (v: number): number;
  domain: [number, number];
}

/** 線性比例尺；domain 兩端相同時放在 range 中間 */
export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const f = ((v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0))) as LinearScale;
  f.domain = domain;
  return f;
}

/** 1、2、5 乘以 10 的次方中，最接近 raw 而不小於它的「好看」間距 */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * 涵蓋 [min, max] 的刻度，大約 count 格。回傳的頭尾會把資料包住，
 * 拿來當 y 軸的範圍，線就不會貼在邊上。
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / Math.max(1, count));
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** ISO 日期（YYYY-MM-DD）→ 天數，當 x 軸座標用 */
export function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** 與 x 最接近的點的索引（xs 必須由小到大） */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i;
  return best;
}
