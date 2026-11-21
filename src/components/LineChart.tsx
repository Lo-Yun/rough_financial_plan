import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dayNumber, linearScale, nearestIndex, niceTicks } from '../core/chart';

/**
 * 輕量折線圖（手寫 SVG，取代 Recharts，見技術債 T10）。
 * 一條線（中間值），可選的範圍陰影（low～high）。淨值歷史、首頁趨勢與投資趨勢共用。
 *
 * - 一般模式：y 軸刻度、首尾日期、上方提示框（平時是最新一點；滑鼠、觸控、左右鍵移動時顯示十字線）。
 * - 精簡模式（compact）：只有線與最後一點（不畫陰影，y 軸只包住中間值），不能互動，給卡片裡的小趨勢用。
 *
 * 顏色只用 `--accent`（品牌色）與中性的 `--line`／`--muted`，字級用 `--fs-caption`。
 */
export interface ChartPoint {
  /** ISO 日期 YYYY-MM-DD */
  date: string;
  value: number;
  low?: number;
  high?: number;
}

interface Props {
  points: ChartPoint[];
  formatValue: (v: number) => string;
  /** 提示框裡的範圍文字；沒給就不顯示範圍 */
  formatRange?: (low: number, high: number) => string;
  /** 圖的文字說明（一般模式給螢幕報讀器） */
  ariaLabel?: string;
  height?: number;
  compact?: boolean;
}

/** 上方留給提示框（平時顯示最新一點） */
const PAD = { top: 56, right: 8, bottom: 24, left: 56 };
const PAD_COMPACT = { top: 6, right: 6, bottom: 6, left: 6 };
const MAX_DOTS = 24;

export function LineChart({ points, formatValue, formatRange, ariaLabel, height = 240, compact = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;
    const pad = compact ? PAD_COMPACT : PAD;
    const xs = points.map((p) => dayNumber(p.date));
    const lows = points.map((p) => p.low ?? p.value);
    const highs = points.map((p) => p.high ?? p.value);
    const ticks = compact ? [] : niceTicks(Math.min(...lows), Math.max(...highs), 4);
    // 精簡模式只看走勢：不畫範圍陰影，y 軸只包住中間值，變化才看得出來
    const values = points.map((p) => p.value);
    const yDomain: [number, number] = compact ? [Math.min(...values), Math.max(...values)] : [ticks[0]!, ticks.at(-1)!];
    const x = linearScale([xs[0]!, xs.at(-1)!], [pad.left, width - pad.right]);
    const y = linearScale(yDomain, [height - pad.bottom, pad.top]);
    const px = xs.map(x);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${r(px[i]!)},${r(y(p.value))}`).join('');
    const hasBand = !compact && points.some((p) => p.low !== undefined && p.high !== undefined && p.low !== p.high);
    const band = hasBand
      ? `${points.map((p, i) => `${i ? 'L' : 'M'}${r(px[i]!)},${r(y(p.high ?? p.value))}`).join('')}` +
        `${[...points].reverse().map((p, j) => `L${r(px[points.length - 1 - j]!)},${r(y(p.low ?? p.value))}`).join('')}Z`
      : null;
    return { pad, px, y, ticks, line, band };
  }, [width, points, height, compact]);

  if (points.length === 0) return null;

  const shown = active ?? points.length - 1;
  const move = (clientX: number) => {
    if (!geo || !wrapRef.current) return;
    const left = wrapRef.current.getBoundingClientRect().left;
    setActive(nearestIndex(geo.px, clientX - left));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    setActive(Math.min(points.length - 1, Math.max(0, shown + d)));
  };

  const p = points[shown]!;
  const tipX = geo ? geo.px[shown]! : 0;

  return (
    <div ref={wrapRef} className={compact ? 'line-chart compact' : 'line-chart'} style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          role={compact ? undefined : 'img'}
          aria-hidden={compact ? true : undefined}
          aria-label={compact ? undefined : ariaLabel}
          tabIndex={compact ? undefined : 0}
          onPointerMove={compact ? undefined : (e: PointerEvent) => move(e.clientX)}
          onPointerDown={compact ? undefined : (e: PointerEvent) => move(e.clientX)}
          onPointerLeave={compact ? undefined : () => setActive(null)}
          onKeyDown={compact ? undefined : onKey}
          onBlur={compact ? undefined : () => setActive(null)}
        >
          {!compact &&
            geo.ticks.map((tv) => (
              <g key={tv}>
                <line className="lc-grid" x1={geo.pad.left} x2={width - geo.pad.right} y1={r(geo.y(tv))} y2={r(geo.y(tv))} />
                <text className="lc-label" x={geo.pad.left - 8} y={r(geo.y(tv))} textAnchor="end" dominantBaseline="middle">
                  {formatValue(tv)}
                </text>
              </g>
            ))}
          {geo.band && <path className="lc-band" d={geo.band} />}
          <path className="lc-line" d={geo.line} />
          {!compact && points.length <= MAX_DOTS && points.map((pt, i) => <circle key={pt.date} className="lc-dot" cx={r(geo.px[i]!)} cy={r(geo.y(pt.value))} r={4} />)}
          {compact && <circle className="lc-dot" cx={r(geo.px.at(-1)!)} cy={r(geo.y(points.at(-1)!.value))} r={4} />}
          {!compact && (
            <>
              <text className="lc-label" x={geo.pad.left} y={height - 4} textAnchor="start">
                {points[0]!.date.slice(0, 7)}
              </text>
              {points.length > 1 && (
                <text className="lc-label" x={width - geo.pad.right} y={height - 4} textAnchor="end">
                  {points.at(-1)!.date.slice(0, 7)}
                </text>
              )}
            </>
          )}
          {!compact && active !== null && (
            <g>
              <line className="lc-cross" x1={r(tipX)} x2={r(tipX)} y1={geo.pad.top} y2={height - geo.pad.bottom} />
              <circle className="lc-dot active" cx={r(tipX)} cy={r(geo.y(p.value))} r={5} />
            </g>
          )}
        </svg>
      )}
      {!compact && geo && (
        <div className="lc-tip" style={{ left: clamp(tipX, 72, width - 72) }} aria-live="polite">
          <span className="lc-tip-date">{p.date}</span>
          <strong>{formatValue(p.value)}</strong>
          {formatRange && p.low !== undefined && p.high !== undefined && p.low !== p.high && <span className="lc-tip-range">{formatRange(p.low, p.high)}</span>}
        </div>
      )}
    </div>
  );
}

function r(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
}

/** 量容器寬度，視窗或版面變動時更新 */
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.clientWidth);
  }, [ref]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
