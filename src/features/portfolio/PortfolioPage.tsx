import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ageOf, useApp, useFormat } from '../../app/context';
import { RangeValue } from '../../components/Display';
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
import type { LocalePack } from '../../model/localePack';
import type { AllocationGroup, TargetAllocation } from '../../model/types';
import { itemName } from '../balance-sheet/NetWorthPage';

export function PortfolioPage() {
  const { t } = useTranslation();
  const { overview, data, pack, holdings, storedAssumptions, primaryMember, today } = useApp();
  const fmt = useFormat(pack);
  const includeCash = !!data.settings.portfolioIncludeCash;
  const a = useMemo(
    () => analyzePortfolio(overview.balanceSheet.assets, holdings, moneyContext(data, pack), pack, includeCash),
    [overview, holdings, data, pack, includeCash],
  );
  const age = ageOf(primaryMember, today);
  const stored = storedAssumptions?.targetAllocation;
  const target = resolveTarget(stored, pack, age);
  const dev = target.status === 'ok' ? deviations(a, target.allocation, pack.rebalanceBand) : null;
  const offTarget = dev?.items.filter((d) => d.outOfBand) ?? [];
  const hasData = a.items.length > 0 || a.unresolvedAssets.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('portfolio.title')}</h1>
      </header>

      {/* 摘要：總值、風險、配置長條、偏離目標 */}
      <section className="card hero portfolio-summary">
        <p className="eyebrow">{t('portfolio.total')}</p>
        <RangeValue range={a.total} pack={pack} size="lg" />
        {a.items.length > 0 && (
          <>
            <p className={`risk-badge risk-${a.risk.level}`}>
              {t('portfolio.risk.label')}：{t(`portfolio.risk.level${a.risk.level}`)}
            </p>
            <AllocationBar label={t('portfolio.actual')} shares={a.groupShare} compact />
            <AllocationLegend shares={a.groupShare} />
            {dev ? (
              offTarget.length > 0 ? (
                <p className="warn small">{t('portfolio.summary.off', { count: offTarget.length })}</p>
              ) : (
                <p className="ok small">{t('portfolio.summary.ok', { band: Math.round(pack.rebalanceBand * 100) })}</p>
              )
            ) : (
              <p className="small">
                <Link to="/portfolio/target">{t('portfolio.summary.noTarget')} ›</Link>
              </p>
            )}
          </>
        )}
        {a.unresolvedCount > 0 && <p className="muted small">{t('portfolio.unresolved', { count: a.unresolvedCount })}</p>}
      </section>

      {!hasData ? (
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

          {/* 需要處理的事放前面 */}
          {offTarget.length > 0 && (
            <section className="card attention">
              <h2>{t('portfolio.rebalance.title')}</h2>
              <ul className="bullets small">
                {offTarget.map((d) => (
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
            </section>
          )}

          {a.concentration.length > 0 && (
            <section className="card attention">
              <h2>{t('portfolio.concentration.title')}</h2>
              <ul className="bullets small">
                {a.concentration.map((c) => (
                  <li key={c.holdingId ?? c.assetId}>{t('portfolio.concentration.item', { name: c.name, pct: fmt.pct(c.share) })}</li>
                ))}
              </ul>
              <p className="small">{t('portfolio.concentration.explain', { limit: Math.round(pack.concentrationLimit * 100) })}</p>
            </section>
          )}

          <AccountsCard a={a} />

          {a.items.length > 0 && (
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
                        <td>
                          {fmt.pct(a.groupShare[g])}
                          {d?.outOfBand && (
                            <span className="warn" aria-label={t(d.diff > 0 ? 'portfolio.overTarget' : 'portfolio.underTarget')}>
                              {' '}
                              {d.diff > 0 ? '↑' : '↓'}
                            </span>
                          )}
                        </td>
                        {d && <td>{fmt.pct(d.target)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ClassBreakdown a={a} />
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
        </>
      )}

      <Link to="/portfolio/target" className="card link-card">
        <span>
          {t('portfolio.settingsTitle')}
          <small className="muted block">
            {t('portfolio.targetTitle')}：{targetLabel(stored, pack, t)}
            {includeCash && `・${t('portfolio.includeCashShort')}`}
          </small>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <p className="disclaimer">{t('portfolio.disclaimer')}</p>
    </div>
  );
}

/** 目前的目標配置名稱：範本名、「自訂」或「還沒設定」 */
function targetLabel(stored: TargetAllocation | undefined, pack: LocalePack, t: TFunction): string {
  if (!stored) return t('portfolio.targetNone');
  if ('custom' in stored) return t('portfolio.preset.custom');
  const preset = pack.allocationPresets.find((p) => p.id === stored.preset);
  return preset ? t(preset.i18nKey) : t('portfolio.targetNone');
}

function AccountsCard({ a }: { a: PortfolioAnalysis }) {
  const { t } = useTranslation();
  const { pack, holdings } = useApp();
  const fmt = useFormat(pack);
  return (
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
  );
}

/** 摘要卡用的圖例：色點＋大類＋比例 */
function AllocationLegend({ shares }: { shares: Record<AllocationGroup, number> }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  return (
    <ul className="alloc-legend" aria-hidden="true">
      {ALLOCATION_GROUPS.filter((g) => shares[g] > 0.0005).map((g) => (
        <li key={g}>
          <span className={`swatch g-${g}`} />
          {t(`portfolio.groupName.${g}`)} {fmt.pct(shares[g])}
        </li>
      ))}
    </ul>
  );
}

/** 100% 堆疊長條；每段之間留 2px 間隔，顏色依大類固定 */
function AllocationBar({ label, shares, compact }: { label: string; shares: Record<AllocationGroup, number>; compact?: boolean }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  const parts = ALLOCATION_GROUPS.filter((g) => shares[g] > 0.0005);
  return (
    <div className={compact ? 'alloc-bar-row compact' : 'alloc-bar-row'}>
      {!compact && <span className="alloc-bar-label">{label}</span>}
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
