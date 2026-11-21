import { useTranslation } from 'react-i18next';
import { useApp, useFormat } from '../../app/context';
import { RangeValue } from '../../components/Display';
import { Icon } from '../../components/Icon';
import { LineChart } from '../../components/LineChart';

export function HistoryPage() {
  const { t } = useTranslation();
  const { snapshots, pack, repo } = useApp();
  const fmt = useFormat(pack);

  const points = snapshots.map((s) => ({
    date: s.date,
    value: s.summary.netWorth.mid,
    low: s.summary.netWorth.low,
    high: s.summary.netWorth.high,
  }));

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('history.title')}</h1>
      </header>

      {snapshots.length < 2 ? (
        <section className="card">
          <p>{t('history.needTwo')}</p>
        </section>
      ) : (
        <section className="card chart-card">
          <LineChart
            points={points}
            formatValue={fmt.money}
            formatRange={(low, high) => fmt.range({ low, mid: (low + high) / 2, high })}
            ariaLabel={t('history.chartAria')}
            height={280}
          />
          <p className="muted small">{t('history.bandHint')}</p>
        </section>
      )}

      <section className="card items">
        <ul className="item-list">
          {[...snapshots].reverse().map((s) => (
            <li key={s.id}>
              <div className="row">
                <span className="name">
                  {s.date}
                  <small className="muted block">
                    {t(`snapshot.trigger.${s.trigger}`)} · {t('history.precision', { pct: Math.round(s.summary.precision * 100) })}
                  </small>
                </span>
                <span className="amount">
                  <RangeValue range={s.summary.netWorth} pack={pack} />
                </span>
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={t('common.delete')}
                  onClick={() => {
                    if (confirm(t('history.confirmDelete', { date: s.date }))) void repo.deleteSnapshot(s.id);
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {snapshots.length === 0 && <p className="muted">{t('history.empty')}</p>}
      </section>
    </div>
  );
}
