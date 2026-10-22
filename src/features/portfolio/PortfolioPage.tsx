import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ageOf, useApp, useFormat } from '../../app/context';
import { RangeValue } from '../../components/Display';
import { PercentField } from '../../components/EditorParts';
import { moneyContext } from '../../core/overview';
import {
  ALLOCATION_GROUPS,
  analyzePortfolio,
  ASSET_CLASSES,
  CLASS_GROUP,
  deviations,
  resolveTarget,
  type PortfolioAnalysis,
} from '../../core/portfolio';
import type { AllocationGroup, TargetAllocation } from '../../model/types';
import { itemName } from '../balance-sheet/NetWorthPage';

export function PortfolioPage() {
  const { t } = useTranslation();
  const { overview, data, pack, holdings, repo, storedAssumptions, primaryMember, today } = useApp();
  const fmt = useFormat(pack);
  const includeCash = !!data.settings.portfolioIncludeCash;
  const a = useMemo(
    () => analyzePortfolio(overview.balanceSheet.assets, holdings, moneyContext(data, pack), pack, includeCash),
    [overview, holdings, data, pack, includeCash],
  );
  const age = ageOf(primaryMember, today);
  const target = resolveTarget(storedAssumptions?.targetAllocation, pack, age);
  const dev = target.status === 'ok' ? deviations(a, target.allocation, pack.rebalanceBand) : null;
  const hid = data.household.id;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('portfolio.title')}</h1>
      </header>

      <section className="card hero">
        <p className="eyebrow">{t('portfolio.total')}</p>
        <RangeValue range={a.total} pack={pack} size="lg" />
        {a.items.length > 0 && (
          <p className={`risk-badge risk-${a.risk.level}`}>
            {t('portfolio.risk.label')}：{t(`portfolio.risk.level${a.risk.level}`)}
          </p>
        )}
        <label className="toggle-row inline">
          <input type="checkbox" checked={includeCash} onChange={(e) => void repo.updateSettings(hid, { portfolioIncludeCash: e.target.checked })} />
          <span>{t('portfolio.includeCash')}</span>
        </label>
        {a.unresolvedCount > 0 && <p className="muted small">{t('portfolio.unresolved', { count: a.unresolvedCount })}</p>}
      </section>

      {a.items.length === 0 && a.unresolvedAssets.length === 0 ? (
        <section className="card">
          <p>{t('portfolio.empty')}</p>
          <Link to="/asset/new" className="btn ghost">
            + {t('netWorth.add.asset')}
          </Link>
        </section>
      ) : (
        <>
          {a.guessedCount > 0 && (
            <section className="card tip">
              <p>{t('portfolio.guessed', { count: a.guessedCount })}</p>
            </section>
          )}

          <section className="card">
            <h2>{t('portfolio.allocation')}</h2>
            <AllocationBar label={t('portfolio.actual')} shares={a.groupShare} />
            {target.status === 'ok' && <AllocationBar label={t('portfolio.target')} shares={target.allocation} />}
            <table className="alloc-table">
              <thead>
                <tr>
                  <th>{t('portfolio.group')}</th>
                  <th>{t('portfolio.actual')}</th>
                  {dev && <th>{t('portfolio.target')}</th>}
                </tr>
              </thead>
              <tbody>
                {ALLOCATION_GROUPS.map((g) => {
                  const d = dev?.items.find((x) => x.group === g);
                  return (
                    <tr key={g}>
                      <th>
                        <span className={`swatch g-${g}`} aria-hidden="true" />
                        {t(`portfolio.groupName.${g}`)}
                      </th>
                      <td>{fmt.pct(a.groupShare[g])}</td>
                      {d && <td className={d.outOfBand ? 'warn' : ''}>{fmt.pct(d.target)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ClassBreakdown a={a} />
          </section>

          <TargetSection
            stored={storedAssumptions?.targetAllocation}
            onChange={(targetAllocation) => void repo.saveAssumptions(hid, { targetAllocation })}
            needsAge={target.status === 'needs_age'}
            onBirthYear={(y) => void repo.updatePrimaryMember(hid, { birthYear: { mode: 'exact', value: y, asOf: today } })}
            age={age}
          />

          {dev && (
            <section className={dev.needsRebalance ? 'card tip' : 'card'}>
              <h2>{t('portfolio.rebalance.title')}</h2>
              {dev.needsRebalance ? (
                <>
                  <ul className="bullets small">
                    {dev.items
                      .filter((d) => d.outOfBand)
                      .map((d) => (
                        <li key={d.group}>
                          {t(d.diff > 0 ? 'portfolio.rebalance.over' : 'portfolio.rebalance.under', {
                            group: t(`portfolio.groupName.${d.group}`),
                            pp: Math.abs(Math.round(d.diff * 100)),
                            amount: fmt.money(Math.abs(d.amount)),
                          })}
                        </li>
                      ))}
                  </ul>
                  <p className="small">{t('portfolio.rebalance.how')}</p>
                </>
              ) : (
                <p className="ok small">{t('portfolio.rebalance.ok', { band: Math.round(pack.rebalanceBand * 100) })}</p>
              )}
            </section>
          )}

          {a.concentration.length > 0 && (
            <section className="card tip">
              <h2>{t('portfolio.concentration.title')}</h2>
              <ul className="bullets small">
                {a.concentration.map((c) => (
                  <li key={c.holdingId ?? c.assetId}>{t('portfolio.concentration.item', { name: c.name, pct: fmt.pct(c.share) })}</li>
                ))}
              </ul>
              <p className="small">{t('portfolio.concentration.explain', { limit: Math.round(pack.concentrationLimit * 100) })}</p>
            </section>
          )}

          {Object.keys(a.currencyShare).length > 1 && (
            <section className="card">
              <h2>{t('portfolio.currency')}</h2>
              <dl className="flow-summary">
                {Object.entries(a.currencyShare).map(([c, s]) => (
                  <div key={c}>
                    <dt>{c}</dt>
                    <dd>{fmt.pct(s ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="card items">
            <h2>{t('portfolio.accounts')}</h2>
            <ul className="item-list">
              {a.items.map((i) => (
                <li key={i.asset.id}>
                  <div className="row">
                    <Link to={`/asset/${i.asset.id}`} className="name">
                      {itemName(i.asset, 'asset', t)}
                      <span className="mode-badge">
                        {(Object.entries(i.allocation) as [string, number][])
                          .sort((x, y) => y[1] - x[1])
                          .map(([cls, s]) => `${t(`portfolio.class.${cls}`)} ${fmt.pct(s)}`)
                          .join('・')}
                      </span>
                      <span className={i.guessed ? 'mode-badge warn' : 'mode-badge'}>{t(`portfolio.source.${i.guessed ? 'guessed' : i.source}`)}</span>
                    </Link>
                    <span className="amount">
                      {fmt.money(i.value.mid)}
                      <Link to={`/asset/${i.asset.id}/holdings`} className="small block">
                        {t('portfolio.holdingsLink', { count: i.holdings.length })}
                      </Link>
                    </span>
                  </div>
                </li>
              ))}
              {a.unresolvedAssets.map((asset) => (
                <li key={asset.id}>
                  <div className="row">
                    <Link to={`/asset/${asset.id}`} className="name">
                      {itemName(asset, 'asset', t)}
                      <span className="mode-badge warn">{t('portfolio.noValue')}</span>
                    </Link>
                    <span className="amount">
                      ？
                      <Link to={`/asset/${asset.id}/holdings`} className="small block">
                        {t('portfolio.holdingsLink', { count: holdings.filter((h) => h.assetId === asset.id).length })}
                      </Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="disclaimer">{t('portfolio.disclaimer')}</p>
    </div>
  );
}

/** 100% 堆疊長條；每段之間留 2px 間隔，顏色依大類固定 */
function AllocationBar({ label, shares }: { label: string; shares: Record<AllocationGroup, number> }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  const parts = ALLOCATION_GROUPS.filter((g) => shares[g] > 0.0005);
  return (
    <div className="alloc-bar-row">
      <span className="alloc-bar-label">{label}</span>
      <div className="alloc-bar" role="img" aria-label={`${label}：${parts.map((g) => `${t(`portfolio.groupName.${g}`)} ${fmt.pct(shares[g])}`).join('、')}`}>
        {parts.map((g) => (
          <span key={g} className={`seg g-${g}`} style={{ flexGrow: shares[g] }} title={`${t(`portfolio.groupName.${g}`)} ${fmt.pct(shares[g])}`} />
        ))}
      </div>
    </div>
  );
}

function ClassBreakdown({ a }: { a: PortfolioAnalysis }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  const rows = ASSET_CLASSES.filter((c) => (a.byClass[c] ?? 0) > 0);
  return (
    <details className="class-breakdown">
      <summary>{t('portfolio.byClass')}</summary>
      <table className="alloc-table">
        <tbody>
          {rows.map((c) => (
            <tr key={c}>
              <th>
                <span className={`swatch g-${CLASS_GROUP[c]}`} aria-hidden="true" />
                {t(`portfolio.class.${c}`)}
              </th>
              <td>{fmt.pct(a.classShare[c] ?? 0)}</td>
              <td>{fmt.money(a.byClass[c] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
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
          <button key={p.id} type="button" className={current === p.id ? 'chip active' : 'chip'} onClick={() => onChange({ preset: p.id })}>
            {t(p.i18nKey)}
          </button>
        ))}
        <button type="button" className={current === 'custom' ? 'chip active' : 'chip'} onClick={() => onChange({ custom })}>
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
