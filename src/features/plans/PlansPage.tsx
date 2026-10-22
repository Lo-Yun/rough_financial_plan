import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp, useFormat, usePlanningContext } from '../../app/context';
import { ProgressBar } from '../../components/Display';
import { projectGoal } from '../../core/planning';
import type { GoalType } from '../../model/types';

export function goalName(g: { name?: string; type: GoalType }, t: (k: string) => string): string {
  return g.name || t(`plans.type.${g.type}.name`);
}

export function PlansPage() {
  const { t } = useTranslation();
  const { goals, pack, overview } = useApp();
  const fmt = useFormat(pack);
  const ctx = usePlanningContext();
  const projections = useMemo(() => goals.map((g) => ({ goal: g, p: projectGoal(g, ctx) })), [goals, ctx]);
  const sharingSurplus = projections.filter((x) => x.p.contributionSource === 'surplus' && !x.p.reached).length;
  const hasHighInterest = overview.debts.some((d) => d.isHighInterest);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('plans.title')}</h1>
      </header>

      {projections.length === 0 && (
        <section className="card">
          <p>{t('plans.empty')}</p>
          <div className="suggest-list">
            {hasHighInterest && (
              <Link to="/plans/new?type=debt_payoff" className="btn ghost">
                {t('plans.type.debt_payoff.name')}
              </Link>
            )}
            <Link to="/plans/new?type=emergency_fund" className="btn ghost">
              {t('plans.type.emergency_fund.name')}
            </Link>
            <Link to="/plans/new?type=retirement_fi" className="btn ghost">
              {t('plans.type.retirement_fi.name')}
            </Link>
          </div>
        </section>
      )}

      {sharingSurplus >= 2 && (
        <section className="card tip">
          <p>{t('plans.sharedSurplus', { count: sharingSurplus, v: fmt.money(overview.surplus?.mid ?? 0) })}</p>
        </section>
      )}

      {projections.map(({ goal, p }) => (
        <Link key={goal.id} to={`/plans/${goal.id}`} className="card goal-card">
          <header className="section-head">
            <h2>{goalName(goal, t)}</h2>
            <span className="total">{p.target ? fmt.money(p.target.mid) : '—'}</span>
          </header>
          {p.progress !== null && <ProgressBar value={p.progress} label={t('plans.proj.progress')} />}
          <p className="small">
            {p.reached
              ? t('plans.proj.reached')
              : p.eta?.expected != null
                ? t('plans.card.eta', { duration: fmt.duration(p.eta.expected) })
                : p.eta
                  ? t('plans.proj.never')
                  : p.target
                    ? t('plans.proj.noContribution')
                    : t('plans.proj.noTarget')}
          </p>
        </Link>
      ))}

      <Link to="/plans/new" className="btn primary">
        + {t('plans.add')}
      </Link>

      <p className="disclaimer">{t('plans.disclaimer')}</p>
    </div>
  );
}
