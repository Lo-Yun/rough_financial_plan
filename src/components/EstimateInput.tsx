import { useTranslation } from 'react-i18next';
import { convertEstimate, resolveEstimate, withStatKey } from '../core/estimate';
import type { Bracket, LocalePack } from '../model/localePack';
import type { CurrencyCode, Estimate, EstimateMode, ISODate } from '../model/types';
import { useFormat } from '../app/context';
import { AmountField } from './AmountField';

interface Props {
  value: Estimate;
  onChange: (e: Estimate) => void;
  pack: LocalePack;
  today: ISODate;
  defaultTolerance: number;
  brackets?: Bracket[];
  /** 「不確定」時代入的統計值 key */
  statKey?: string;
  currency?: CurrencyCode;
  onCurrencyChange?: (c: CurrencyCode) => void;
}

const MODES: EstimateMode[] = ['unknown', 'range', 'approx', 'exact'];

/** 全 App 共用的估算輸入元件（見規格 4.2） */
export function EstimateInput(props: Props) {
  const { value, onChange, pack, today, defaultTolerance, brackets, statKey, currency, onCurrencyChange } = props;
  const { t } = useTranslation();
  const fmt = useFormat(pack);
  const ctx = { statistics: pack.statistics, defaultTolerance };

  // 還沒填的範圍（0 ~ 0）留白，讓 placeholder 顯示
  const blank = value.mode === 'range' && value.low === 0 && value.high === 0;

  const switchMode = (m: EstimateMode) => onChange(withStatKey(convertEstimate(value, m, ctx, today), statKey));

  return (
    <div className="estimate-input">
      <div className="segmented" role="radiogroup" aria-label={t('estimate.modeLabel')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.mode === m}
            className={value.mode === m ? 'active' : ''}
            onClick={() => switchMode(m)}
          >
            {t(`estimate.mode.${m}`)}
          </button>
        ))}
      </div>

      <div className="estimate-body">
        {value.mode === 'unknown' && <UnknownBody value={value} ctx={ctx} fmt={fmt} />}

        {value.mode === 'range' && (
          <>
            {brackets && (
              <div className="chips">
                {brackets.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={value.bracketId === b.id} className={value.bracketId === b.id ? 'chip active' : 'chip'}
                    onClick={() => onChange({ mode: 'range', low: b.low, high: b.high, bracketId: b.id })}
                  >
                    {b.low === 0 ? t('estimate.below', { v: fmt.money(b.high) }) : fmt.range({ low: b.low, mid: 0, high: b.high })}
                  </button>
                ))}
              </div>
            )}
            <div className="range-fields">
              <AmountField
                pack={pack}
                label={t('estimate.low')}
                value={blank ? undefined : value.low}
                showHint={false}
                placeholder={t('amount.placeholderShort')}
                onChange={(v) => onChange({ mode: 'range', low: v ?? 0, high: value.high })}
              />
              <AmountField
                pack={pack}
                label={t('estimate.high')}
                value={value.high || undefined}
                showHint={false}
                placeholder={t('amount.placeholderShort')}
                onChange={(v) => onChange({ mode: 'range', low: value.low, high: v ?? 0 })}
              />
            </div>
            <p className="muted small">{t('amount.hint')}</p>
          </>
        )}

        {value.mode === 'approx' && (
          <>
            <AmountField pack={pack} value={value.value || undefined} onChange={(v) => onChange({ ...value, value: v ?? 0 })} />
            <p className="muted small">
              {t('estimate.approxNote', { pct: Math.round((value.tolerance ?? defaultTolerance) * 100) })}
            </p>
          </>
        )}

        {value.mode === 'exact' && (
          <>
            <AmountField pack={pack} value={value.value || undefined} onChange={(v) => onChange({ ...value, value: v ?? 0 })} />
            <label className="inline-field">
              <span>{t('estimate.asOf')}</span>
              <input
                type="date"
                value={value.asOf}
                max={today}
                onChange={(e) => e.target.value && onChange({ ...value, asOf: e.target.value })}
              />
            </label>
          </>
        )}
      </div>

      {onCurrencyChange && (
        <label className="inline-field">
          <span>{t('estimate.currency')}</span>
          <select value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
            {pack.commonCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function UnknownBody({
  value,
  ctx,
  fmt,
}: {
  value: Extract<Estimate, { mode: 'unknown' }>;
  ctx: Parameters<typeof resolveEstimate>[1];
  fmt: ReturnType<typeof useFormat>;
}) {
  const { t } = useTranslation();
  const r = resolveEstimate(value, ctx);
  return (
    <p className="muted">
      {r ? t('estimate.unknownWithStat', { range: fmt.range(r) }) : t('estimate.unknownNoStat')}
    </p>
  );
}
