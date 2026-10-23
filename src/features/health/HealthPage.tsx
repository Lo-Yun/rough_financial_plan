import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp, useFormat } from '../../app/context';
import { ProgressBar } from '../../components/Display';
import { IconBadge, type IconName } from '../../components/Icon';
import { computeHealth, type HealthMetric, type Light } from '../../core/health';
import { moneyContext } from '../../core/overview';
import type { HealthMetricKey } from '../../model/localePack';
import type { Range } from '../../model/types';

/** 每個指標建議的下一步要去哪裡 */
const ACTION_LINK: Record<HealthMetricKey, string> = {
  high_interest_debt: '/plans/new?type=debt_payoff',
  emergency_months: '/plans/new?type=emergency_fund',
  savings_rate: '/cashflow',
  debt_service_ratio: '/plans/new?type=debt_payoff',
  unsecured_debt_multiple: '/plans/new?type=debt_payoff',
  housing_cost_ratio: '/cashflow',
  insurance_premium_ratio: '/cashflow',
};

const METRIC_ICONS: Record<HealthMetricKey, IconName> = {
  high_interest_debt: 'creditCard',
  emergency_months: 'lifebuoy',
  savings_rate: 'piggyBank',
  debt_service_ratio: 'percent',
  unsecured_debt_multiple: 'scale',
  housing_cost_ratio: 'home',
  insurance_premium_ratio: 'umbrella',
};

export function HealthPage() {
  const { t } = useTranslation();
  const { overview, pack, data, assumptions } = useApp();
  const fmt = useFormat(pack);
  const report = useMemo(
    () => computeHealth(overview, data.expenses.filter((e) => !e.archivedAt), pack, moneyContext(data, pack), assumptions.safeWithdrawalRate),
    [overview, data, pack, assumptions],
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('health.title')}</h1>
      </header>

      {report.top ? (
        <section className={`card top-issue light-${report.top.light}`}>
          <p className="eyebrow">{t('health.topTitle')}</p>
          <h2>{t(`health.metric.${report.top.key}.name`)}</h2>
          <p>{t(`health.metric.${report.top.key}.action`)}</p>
          <Link to={ACTION_LINK[report.top.key]} className="btn primary">
            {t(`health.metric.${report.top.key}.cta`)}
          </Link>
        </section>
      ) : (
        <section className="card top-issue light-green">
          <p className="eyebrow">{t('health.topTitle')}</p>
          <p>{t('health.allGood')}</p>
        </section>
      )}

      <p className="muted small">{t('health.precisionNote', { pct: Math.round(overview.precision.score * 100) })}</p>

      {report.metrics.map((m) => (
        <MetricCard key={m.key} m={m} />
      ))}

      <section className="card">
        <h2>{t('health.fi.title')}</h2>
        <p className="muted small">{t('health.fi.explain', { pct: fmt.pct(assumptions.safeWithdrawalRate) })}</p>
        {report.fi.target && report.fi.progress ? (
          <>
            <ProgressBar value={Math.min(1, Math.max(0, report.fi.progress.mid))} label={t('health.fi.title')} />
            <p>
              {t('health.fi.progress', {
                pct: fmt.pct(report.fi.progress.mid),
                have: fmt.money(report.fi.investable.mid),
                target: fmt.money(report.fi.target.mid),
              })}
            </p>
            <Link to="/plans/new?type=retirement_fi">{t('health.fi.cta')}</Link>
          </>
        ) : (
          <p className="muted">{t('health.missing.no_expense')}</p>
        )}
      </section>

      <p className="disclaimer">{t('common.disclaimer')}</p>
    </div>
  );
}

function MetricCard({ m }: { m: HealthMetric }) {
  const { t } = useTranslation();
  const { pack } = useApp();
  const fmt = useFormat(pack);
  const th = pack.healthThresholds[m.key];

  /** 主要顯示中間值，範圍放在下面一行 */
  const value = (r: Range): { main: string; range?: string } => {
    const exact = r.high - r.low < 1e-9;
    switch (m.key) {
      case 'emergency_months':
        return {
          main: t('health.unit.months', { v: r.mid.toFixed(1) }),
          range: r.high - r.low < 0.1 ? undefined : t('health.unit.monthsRange', { a: r.low.toFixed(1), b: r.high.toFixed(1) }),
        };
      case 'high_interest_debt':
        return r.high <= 0 ? { main: t('health.none') } : { main: fmt.money(r.mid), range: exact ? undefined : fmt.range(r) };
      case 'unsecured_debt_multiple':
        return {
          main: t('health.unit.times', { v: r.mid.toFixed(1) }),
          range: exact ? undefined : t('health.unit.timesRange', { a: r.low.toFixed(1), b: r.high.toFixed(1) }),
        };
      default:
        return { main: fmt.pct(r.mid), range: exact ? undefined : fmt.pctRange(r) };
    }
  };
  const shown = m.value ? value(m.value) : null;

  const target = (v: number): string => {
    switch (m.key) {
      case 'emergency_months':
        return t('health.unit.months', { v });
      case 'unsecured_debt_multiple':
        return t('health.unit.times', { v });
      case 'high_interest_debt':
        return '0';
      default:
        return fmt.pct(v);
    }
  };

  return (
    <section className={`card metric light-${m.light ?? 'none'}`}>
      <header className="metric-head">
        <IconBadge name={METRIC_ICONS[m.key]} />
        <h3>{t(`health.metric.${m.key}.name`)}</h3>
        <span className="metric-value">
          {shown ? (shown.range ? `${t('range.about')}${shown.main}` : shown.main) : '—'}
          {shown?.range && <small className="muted block">{shown.range}</small>}
        </span>
      </header>
      <LightBadge light={m.light} />
      <p className="small">{t(`health.metric.${m.key}.explain`)}</p>
      {m.missing && !m.value && <p className="muted small">{t(`health.missing.${m.missing}`)}</p>}
      {m.value && m.key !== 'high_interest_debt' && (
        <p className="muted small">
          {t(`health.goal.${th.better}`, { green: target(th.green), yellow: target(th.yellow) })}
        </p>
      )}
      {m.spans && m.lightRange && (
        <p className="muted small">
          {t('health.spans', { a: t(`health.light.${m.lightRange[0]}`), b: t(`health.light.${m.lightRange[1]}`) })}
        </p>
      )}
      {m.note && <p className="small">{t(`health.metric.${m.key}.${m.note}`)}</p>}
      {(m.light === 'red' || m.light === 'yellow') && (
        <p className="small">
          {t(`health.metric.${m.key}.action`)} <Link to={ACTION_LINK[m.key]}>{t(`health.metric.${m.key}.cta`)} ›</Link>
        </p>
      )}
    </section>
  );
}

function LightBadge({ light }: { light: Light | null }) {
  const { t } = useTranslation();
  return <span className={`light-badge ${light ?? 'none'}`}>{light ? t(`health.light.${light}`) : t('health.light.none')}</span>;
}
