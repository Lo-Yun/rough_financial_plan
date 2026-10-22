import { useTranslation } from 'react-i18next';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, useFormat } from '../../app/context';
import { RangeValue } from '../../components/Display';

export function HistoryPage() {
  const { t } = useTranslation();
  const { snapshots, pack, repo } = useApp();
  const fmt = useFormat(pack);

  const points = snapshots.map((s) => ({
    date: s.date,
    mid: s.summary.netWorth.mid,
    band: [s.summary.netWorth.low, s.summary.netWorth.high] as [number, number],
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
          <div className="chart" role="img" aria-label={t('history.chartAria')}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis width={64} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(v: number) => fmt.money(v)} />
                <Tooltip
                  formatter={(v, name) =>
                    name === 'band' && Array.isArray(v)
                      ? [fmt.range({ low: Number(v[0]), mid: 0, high: Number(v[1]) }), t('history.band')]
                      : [fmt.money(Number(v)), t('history.mid')]
                  }
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }}
                />
                <Area dataKey="band" stroke="none" fill="var(--accent)" fillOpacity={0.15} isAnimationActive={false} />
                <Line dataKey="mid" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
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
                  ✕
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
