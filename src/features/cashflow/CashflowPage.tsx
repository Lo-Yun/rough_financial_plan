import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp, useFormat } from '../../app/context';
import { ModeBadge, RangeValue } from '../../components/Display';
import { EstimateInput } from '../../components/EstimateInput';
import { toMonthly } from '../../core/cashflow';
import { resolveMoney } from '../../core/currency';
import { blankToUnknown } from '../../core/estimate';
import { add, div, point, sub } from '../../core/interval';
import { moneyContext } from '../../core/overview';
import { reconcile } from '../../core/reconcile';
import type { Estimate, ExpenseItem, IncomeItem, Range } from '../../model/types';
import { flowName } from './FlowEditor';

export function CashflowPage() {
  const { t } = useTranslation();
  const { overview, pack, data } = useApp();
  const fmt = useFormat(pack);
  const incomes = data.incomes.filter((x) => !x.archivedAt);
  const expenses = data.expenses.filter((x) => !x.archivedAt);
  const outflow = overview.expense.total ? add(overview.expense.total, overview.debtPayments) : null;
  const outflowShare = outflow && overview.income.total ? div(outflow, overview.income.total) : null;
  const savingsRate = outflowShare ? sub(point(1), outflowShare) : null;
  // 快速估算只建立一筆「總花費」時，提醒可以拆成細項
  const onlyTotal = expenses.length === 1 && expenses[0]!.category === 'other';

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('cashflow.title')}</h1>
      </header>

      <section className="card hero">
        <p className="eyebrow">{t('cashflow.surplus')}</p>
        {overview.surplus ? (
          <>
            <RangeValue range={overview.surplus} pack={pack} size="lg" />
            {overview.surplus.mid < 0 && <p className="warn small">{t('cashflow.deficit')}</p>}
          </>
        ) : (
          <p className="muted">{t('cashflow.surplusUnknown')}</p>
        )}
        <dl className="flow-summary">
          {row(t('cashflow.income'), overview.income.total, '+')}
          {row(t('cashflow.expense'), overview.expense.total, '−')}
          {row(t('cashflow.debtPayments'), overview.debtPayments, '−', '/')}
          {savingsRate && (
            <div>
              <dt>{t('cashflow.savingsRate')}</dt>
              <dd>
                {t('range.about')}
                {fmt.pct(savingsRate.mid)}
                {savingsRate.low !== savingsRate.high && <small className="muted block">{fmt.pctRange(savingsRate)}</small>}
              </dd>
            </div>
          )}
        </dl>
        {(overview.income.unresolvedCount > 0 || overview.expense.unresolvedCount > 0) && (
          <p className="muted small">{t('cashflow.unresolved', { count: overview.income.unresolvedCount + overview.expense.unresolvedCount })}</p>
        )}
      </section>

      <FlowSection kind="income" items={incomes} />

      {onlyTotal && (
        <section className="card tip">
          <p>{t('cashflow.splitTip')}</p>
        </section>
      )}
      <FlowSection kind="expense" items={expenses} />

      <ReconcileCard />

      <p className="disclaimer">{t('cashflow.debtNote')}</p>
    </div>
  );

  function row(label: string, range: Range | null, sign: string, link?: string) {
    const value = range ? `${sign} ${fmt.money(range.mid)}` : '？';
    return (
      <div>
        <dt>{label}</dt>
        <dd>{link ? <Link to={link}>{value}</Link> : value}</dd>
      </div>
    );
  }
}

function FlowSection({ kind, items }: { kind: 'income' | 'expense'; items: (IncomeItem | ExpenseItem)[] }) {
  const { t } = useTranslation();
  const { pack, data, today, overview } = useApp();
  const fmt = useFormat(pack);
  const ctx = moneyContext(data, pack);
  const defs = kind === 'income' ? pack.categories.income : pack.categories.expense;
  const total = kind === 'income' ? overview.income.total : overview.expense.total;
  const sorted = [...items].sort((a, b) => defs.findIndex((d) => d.key === a.category) - defs.findIndex((d) => d.key === b.category));

  return (
    <section className="card items">
      <header className="section-head">
        <h2>{t(`cashflow.section.${kind}`)}</h2>
        <span className="total">{total ? t('cashflow.perMonth', { v: fmt.money(total.mid) }) : ''}</span>
      </header>
      {sorted.length === 0 && <p className="muted">{t(`cashflow.empty.${kind}`)}</p>}
      <ul className="item-list">
        {sorted.map((item) => {
          const r = resolveMoney(item.amount, ctx);
          const monthly = r.status === 'ok' ? toMonthly(r.range, item.frequency) : null;
          return (
            <li key={item.id}>
              <Link to={`/${kind}/${item.id}`}>
                <span className="name">
                  {flowName(item, kind, t)}
                  <span className="mode-badge">
                    {t(`frequency.${item.frequency}`)}
                    {'essential' in item && !item.essential && ` · ${t('cashflow.nonEssential')}`}
                    {'isRecurring' in item && !item.isRecurring && ` · ${t('cashflow.oneOff')}`}
                  </span>
                  <ModeBadge estimate={item.amount.estimate} today={today} staleAfterDays={data.settings.staleAfterDays} />
                </span>
                <span className="amount">
                  {monthly ? (
                    <>
                      {monthly.low !== monthly.high && <span className="approx-mark">{t('range.about')}</span>}
                      {fmt.money(monthly.mid)}
                      {item.frequency !== 'monthly' && <small className="muted block">{t('cashflow.monthlyAvg')}</small>}
                    </>
                  ) : (
                    <span className="muted">？</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link to={`/${kind}/new`} className="btn ghost add">
        + {t(`cashflow.add.${kind}`)}
      </Link>
    </section>
  );
}

function ReconcileCard() {
  const { t } = useTranslation();
  const { pack, data, overview, repo, today } = useApp();
  const fmt = useFormat(pack);
  const saved = data.settings.reconciliation;
  const [editing, setEditing] = useState(!saved);
  const [answer, setAnswer] = useState<Estimate>(saved?.lastYearSavingsChange.estimate ?? { mode: 'range', low: 0, high: 0 });

  const resolved = saved ? resolveMoney(saved.lastYearSavingsChange, moneyContext(data, pack)) : null;
  const result = resolved?.status === 'ok' && overview.surplus ? reconcile(overview.surplus, resolved.range) : null;

  const save = async () => {
    await repo.updateSettings(data.household.id, {
      reconciliation: { lastYearSavingsChange: { estimate: blankToUnknown(answer), currency: pack.baseCurrency }, answeredAt: today },
    });
    setEditing(false);
  };

  return (
    <section className="card">
      <h2>{t('reconcile.title')}</h2>
      <p className="muted small">{t('reconcile.why')}</p>
      {editing ? (
        <>
          <p>{t('reconcile.question')}</p>
          <p className="muted small">{t('reconcile.questionHint')}</p>
          <EstimateInput value={answer} onChange={setAnswer} pack={pack} today={today} defaultTolerance={data.settings.defaultTolerance} brackets={pack.brackets.cash} />
          <div className="button-row">
            <button type="button" className="btn primary" onClick={() => void save()}>
              {t('reconcile.check')}
            </button>
          </div>
        </>
      ) : (
        <>
          {result ? (
            <>
              <dl className="flow-summary">
                <div>
                  <dt>{t('reconcile.estimated')}</dt>
                  <dd>{fmt.range(result.estimatedAnnual)}</dd>
                </div>
                <div>
                  <dt>{t('reconcile.actual')}</dt>
                  <dd>{fmt.range(result.actual)}</dd>
                </div>
              </dl>
              <p className={result.status === 'ok' ? 'ok' : 'warn'}>{t(`reconcile.result.${result.status}`)}</p>
              {result.status === 'expense_underestimated' && (
                <>
                  <p className="small">{t('reconcile.forgottenTitle')}</p>
                  <ul className="bullets small">
                    {pack.forgottenExpenses.map((k) => (
                      <li key={k}>{t(k)}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="muted">{t('reconcile.cannot')}</p>
          )}
          <button type="button" className="btn ghost small" onClick={() => setEditing(true)}>
            {t('reconcile.edit')}
          </button>
        </>
      )}
    </section>
  );
}
