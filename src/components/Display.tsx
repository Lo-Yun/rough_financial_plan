import { useTranslation } from 'react-i18next';
import { isStale } from '../core/precision';
import type { LocalePack } from '../model/localePack';
import type { Estimate, ISODate, Range } from '../model/types';
import { useFormat } from '../app/context';

/** 中間值大字、區間小字 */
export function RangeValue({ range, pack, size = 'md' }: { range: Range; pack: LocalePack; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const fmt = useFormat(pack);
  const exact = range.low === range.high;
  return (
    <div className={`range-value ${size}`}>
      <div className="mid">
        {!exact && <span className="approx-mark">{t('range.about')}</span>}
        {fmt.money(range.mid)}
      </div>
      {!exact && <div className="span">{fmt.range(range)}</div>}
    </div>
  );
}

/** 精確度環 */
export function PrecisionRing({ score, size = 56 }: { score: number; size?: number }) {
  const { t } = useTranslation();
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.round(score * 100);
  return (
    <div className="precision-ring" style={{ width: size, height: size }} role="img" aria-label={t('precision.aria', { pct })}>
      <svg viewBox="0 0 56 56" width={size} height={size}>
        <circle cx="28" cy="28" r={r} className="track" />
        {score > 0 && (
          <circle
            cx="28"
            cy="28"
            r={r}
            className="bar"
            strokeDasharray={`${c * score} ${c}`}
            transform="rotate(-90 28 28)"
          />
        )}
      </svg>
      <span className="pct">{pct}%</span>
    </div>
  );
}

/** 估算模式的小標籤：○ 不確定、◔ 範圍、◑ 大約、● 精確 */
export function ModeBadge({ estimate, today, staleAfterDays }: { estimate: Estimate; today: ISODate; staleAfterDays: number }) {
  const { t } = useTranslation();
  const stale = isStale(estimate, { today, staleAfterDays });
  const symbol = { unknown: '○', range: '◔', approx: '◑', exact: '●' }[estimate.mode];
  return (
    <span className={`mode-badge mode-${estimate.mode}${stale ? ' stale' : ''}`} title={t(`estimate.mode.${estimate.mode}`)}>
      <span aria-hidden="true">{symbol}</span> {stale ? t('estimate.stale') : t(`estimate.mode.${estimate.mode}`)}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className="fill" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
