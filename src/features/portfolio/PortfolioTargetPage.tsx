import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ageOf, useApp } from '../../app/context';
import { PercentField, Toggle } from '../../components/EditorParts';
import { ALLOCATION_GROUPS, resolveTarget } from '../../core/portfolio';
import type { TargetAllocation } from '../../model/types';

/** 投資組合設定 `#/portfolio/target`：目標配置與是否包含現金。從投資頁底部進來，平常不必打開。 */
export function PortfolioTargetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, repo, storedAssumptions, primaryMember, pack, today } = useApp();
  const hid = data.household.id;
  const age = ageOf(primaryMember, today);
  const stored = storedAssumptions?.targetAllocation;
  const target = resolveTarget(stored, pack, age);

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="btn ghost small" onClick={() => navigate(-1)}>
          ‹ {t('common.back')}
        </button>
        <h1>{t('portfolio.settingsTitle')}</h1>
      </header>

      <TargetSection
        stored={stored}
        onChange={(targetAllocation) => void repo.saveAssumptions(hid, { targetAllocation })}
        needsAge={target.status === 'needs_age'}
        onBirthYear={(y) => void repo.updatePrimaryMember(hid, { birthYear: { mode: 'exact', value: y, asOf: today } })}
        age={age}
      />

      <section className="card">
        <Toggle
          checked={!!data.settings.portfolioIncludeCash}
          onChange={(on) => void repo.updateSettings(hid, { portfolioIncludeCash: on })}
          label={t('portfolio.includeCash')}
          hint={t('portfolio.includeCashHint')}
        />
      </section>
    </div>
  );
}

function TargetSection({
  stored,
  onChange,
  needsAge,
  onBirthYear,
  age,
}: {
  stored: TargetAllocation | undefined;
  onChange: (t: TargetAllocation | undefined) => void;
  needsAge: boolean;
  onBirthYear: (y: number) => void;
  age: number | null;
}) {
  const { t } = useTranslation();
  const { pack, today } = useApp();
  const current = stored ? ('preset' in stored ? stored.preset : 'custom') : 'none';
  const custom = stored && 'custom' in stored ? stored.custom : { equity: 0.6, bond: 0.3, cash: 0.1, alternative: 0 };
  const [year, setYear] = useState('');
  const customSum = ALLOCATION_GROUPS.reduce((s, g) => s + (custom[g] ?? 0), 0);

  return (
    <section className="card">
      <h2>{t('portfolio.targetTitle')}</h2>
      <p className="muted small">{t('portfolio.targetExplain')}</p>
      <div className="chips">
        {pack.allocationPresets.map((p) => (
          <button key={p.id} type="button" aria-pressed={current === p.id} className={current === p.id ? 'chip active' : 'chip'} onClick={() => onChange({ preset: p.id })}>
            {t(p.i18nKey)}
          </button>
        ))}
        <button type="button" aria-pressed={current === 'custom'} className={current === 'custom' ? 'chip active' : 'chip'} onClick={() => onChange({ custom })}>
          {t('portfolio.preset.custom')}
        </button>
        {stored && (
          <button type="button" className="chip" onClick={() => onChange(undefined)}>
            {t('portfolio.preset.none')}
          </button>
        )}
      </div>
      {current !== 'none' && current !== 'custom' && <p className="muted small">{t(`portfolio.presetDesc.${current}`, { age: age ?? '?' })}</p>}
      {needsAge && (
        <div className="inline-field">
          <span>{t('portfolio.birthYear')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1920}
            max={Number(today.slice(0, 4))}
            placeholder="1990"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            onBlur={() => Number(year) > 1900 && onBirthYear(Number(year))}
          />
        </div>
      )}
      {current === 'custom' && (
        <>
          {ALLOCATION_GROUPS.map((g) => (
            <PercentField
              key={g}
              label={t(`portfolio.groupName.${g}`)}
              value={custom[g]}
              onChange={(v) => onChange({ custom: { ...custom, [g]: v ?? 0 } })}
            />
          ))}
          <p className={Math.abs(customSum - 1) > 0.001 ? 'warn small' : 'muted small'}>
            {t('portfolio.customSum', { pct: Math.round(customSum * 100) })}
          </p>
        </>
      )}
    </section>
  );
}
