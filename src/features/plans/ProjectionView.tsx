import { useTranslation } from 'react-i18next';
import { useApp, useFormat } from '../../app/context';
import { ProgressBar } from '../../components/Display';
import { lightFor } from '../../core/health';
import { DEFAULT_RETURN_PROFILE, scenarioRates, type GoalProjection } from '../../core/planning';
import type { Goal } from '../../model/types';

/** 依月數推算達成的年月 */
function addMonths(today: string, months: number): { y: number; m: number } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

export function ProjectionView({ goal, p }: { goal: Goal; p: GoalProjection }) {
  const { t } = useTranslation();
  const { pack, today, assumptions, data } = useApp();
  const fmt = useFormat(pack);

  if (!p.target) {
    return <p className="muted">{t(goal.type === 'debt_payoff' ? 'plans.proj.pickDebts' : 'plans.proj.noTarget')}</p>;
  }

  const when = (months: number) => {
    const d = addMonths(today, months);
    return t('plans.proj.when', { duration: fmt.duration(months), y: d.y, m: d.m });
  };

  if (goal.type === 'debt_payoff' && p.debt) {
    const strategy = goal.params?.kind === 'debt_payoff' ? goal.params.strategy : 'avalanche';
    const names = (ids: { id: string }[]) =>
      ids
        .map(({ id }) => {
          const l = data.liabilities.find((x) => x.id === id);
          return l ? l.label || t(`category.liability.${l.category}`) : '';
        })
        .join(' → ');
    return (
      <div className="projection">
        <dl className="flow-summary">
          <div>
            <dt>{t('plans.proj.debtTotal')}</dt>
            <dd>{fmt.range(p.debt.totalBalance)}</dd>
          </div>
          <div>
            <dt>{t('plans.proj.minPayments')}</dt>
            <dd>{fmt.money(p.debt.minPayments)}</dd>
          </div>
          <div>
            <dt>{t('plans.proj.extra')}</dt>
            <dd>{p.contribution ? fmt.money(p.contribution) : t('plans.proj.noExtra')}</dd>
          </div>
        </dl>
        <table className="compare">
          <thead>
            <tr>
              <th />
              <th>{t('plans.strategy.avalanche')}</th>
              <th>{t('plans.strategy.snowball')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>{t('plans.proj.payoffTime')}</th>
              {(['avalanche', 'snowball'] as const).map((s) => (
                <td key={s} className={s === strategy ? 'chosen' : ''}>
                  {p.debt![s].months === null ? t('plans.proj.never') : fmt.duration(p.debt![s].months!)}
                </td>
              ))}
            </tr>
            <tr>
              <th>{t('plans.proj.totalInterest')}</th>
              {(['avalanche', 'snowball'] as const).map((s) => (
                <td key={s} className={s === strategy ? 'chosen' : ''}>
                  {fmt.money(p.debt![s].totalInterest)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="small">{t('plans.proj.order', { order: names(p.debt[strategy].order) })}</p>
        {p.debt.avalanche.totalInterest < p.debt.snowball.totalInterest - 100 && (
          <p className="muted small">
            {t('plans.proj.avalancheSaves', { v: fmt.money(p.debt.snowball.totalInterest - p.debt.avalanche.totalInterest) })}
          </p>
        )}
        {p.debt[strategy].months === null && <p className="warn small">{t('plans.proj.neverHint')}</p>}
        {!p.contribution && <p className="muted small">{t('plans.proj.extraHint')}</p>}
      </div>
    );
  }

  const profile = goal.returnProfile ?? DEFAULT_RETURN_PROFILE[goal.type];
  const rates = scenarioRates(profile, assumptions);
  const housingTh = pack.healthThresholds.housing_cost_ratio;
  const eta = p.eta;
  const onTrack = p.requiredMonthly && p.contribution !== null ? p.contribution >= p.requiredMonthly.mid : null;

  return (
    <div className="projection">
      <dl className="flow-summary">
        <div>
          <dt>{t('plans.proj.target')}</dt>
          <dd>{fmt.range(p.target)}</dd>
        </div>
        <div>
          <dt>{t('plans.proj.current')}</dt>
          <dd>{fmt.range(p.current)}</dd>
        </div>
      </dl>
      {p.progress !== null && <ProgressBar value={p.progress} label={t('plans.proj.progress')} />}

      {p.reached ? (
        <p className="ok">{t('plans.proj.reached')}</p>
      ) : (
        <>
          {p.contribution !== null ? (
            <p className="small">
              {t(`plans.proj.contribution.${p.contributionSource}`, { v: fmt.money(p.contribution) })}
            </p>
          ) : (
            <p className="warn small">{t('plans.proj.noContribution')}</p>
          )}
          {eta &&
            (eta.expected === null ? (
              <p className="warn">{t('plans.proj.never')}</p>
            ) : (
              <>
                <p className="big-line">{when(eta.expected)}</p>
                {eta.earliest !== null && eta.latest !== null && eta.earliest !== eta.latest && (
                  <p className="muted small">
                    {t('plans.proj.etaRange', { a: fmt.duration(eta.earliest), b: fmt.duration(eta.latest) })}
                  </p>
                )}
                {eta.latest === null && <p className="muted small">{t('plans.proj.latestNever')}</p>}
              </>
            ))}
          {p.requiredMonthly && p.monthsLeft !== null && (
            <p className={onTrack === false ? 'warn small' : 'small'}>
              {t('plans.proj.required', { months: fmt.duration(p.monthsLeft), v: fmt.money(p.requiredMonthly.mid), range: fmt.range(p.requiredMonthly) })}
              {onTrack === false && ` ${t('plans.proj.behind')}`}
              {onTrack === true && ` ${t('plans.proj.ahead')}`}
            </p>
          )}
          {p.monthsLeft !== null && p.monthsLeft <= 0 && <p className="warn small">{t('plans.proj.datePassed')}</p>}
        </>
      )}

      {p.home && (
        <div className="sub-question">
          <h3>{t('plans.home.title')}</h3>
          <p className="small">
            {t('plans.home.loan', { loan: fmt.money(p.home.loan.mid), pay: fmt.money(p.home.monthlyPayment.mid), years: pack.homeDefaults.mortgageTermMonths / 12 })}
          </p>
          {p.home.incomeRatio ? (
            <p className={lightFor(p.home.incomeRatio.mid, housingTh) === 'green' ? 'ok small' : 'warn small'}>
              {t(`plans.home.ratio.${lightFor(p.home.incomeRatio.mid, housingTh)}`, { pct: fmt.pct(p.home.incomeRatio.mid) })}
            </p>
          ) : (
            <p className="muted small">{t('health.missing.no_income')}</p>
          )}
        </div>
      )}

      <p className="muted small">
        {t('plans.proj.assumption', {
          profile: t(`plans.profile.${profile}.name`),
          rate: fmt.pct(rates.neutral),
          low: fmt.pct(rates.conservative),
          high: fmt.pct(rates.optimistic),
        })}
      </p>
    </div>
  );
}
