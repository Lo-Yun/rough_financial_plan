import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { recordSnapshot } from '../../app/actions';
import { useApp, useFormat } from '../../app/context';
import { isIOS, isStandalone } from '../../app/pwa';
import { daysBetween } from '../../core/date';
import type { ResolvedItem } from '../../core/balanceSheet';
import { ModeBadge, PrecisionRing, RangeValue } from '../../components/Display';
import type { Asset, Liability } from '../../model/types';
import { LadderSummary } from './LadderSummary';

const BACKUP_REMIND_DAYS = 30;

export function NetWorthPage() {
  const { t } = useTranslation();
  const { overview, pack, data, snapshots, repo, today } = useApp();
  const [view, setView] = useState<'all' | 'accessible'>('all');
  const [savingSnap, setSavingSnap] = useState(false);
  const bs = overview.balanceSheet;
  const s = data.settings;
  const pct = Math.round(overview.precision.score * 100);

  const target = overview.nextRefinement;
  const targetItem = target
    ? target.kind === 'asset'
      ? bs.assets.find((x) => x.item.id === target.id)?.item
      : bs.liabilities.find((x) => x.item.id === target.id)?.item
    : undefined;

  const todaySnap = snapshots.find((x) => x.date === today);
  const lastBackupDays = s.lastBackupAt ? daysBetween(s.lastBackupAt.slice(0, 10), today) : null;
  const showBackup = lastBackupDays === null || lastBackupDays > BACKUP_REMIND_DAYS;
  const showIosInstall = isIOS() && !isStandalone() && !s.dismissedTips.includes('ios_install');

  const dismissTip = (id: string) => void repo.updateSettings(data.household.id, { dismissedTips: [...s.dismissedTips, id] });

  return (
    <div className="page">
      <section className="card hero">
        <div className="segmented small" role="radiogroup">
          {(['all', 'accessible'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {t(`netWorth.view.${v}`)}
            </button>
          ))}
        </div>
        <RangeValue range={view === 'all' ? bs.netWorth : bs.accessibleNetWorth} pack={pack} size="lg" />
        {view === 'accessible' && <p className="muted small">{t('netWorth.accessibleHint')}</p>}
        <div className="precision-row">
          <PrecisionRing score={overview.precision.score} />
          <p>
            {t('netWorth.precision', { pct })}
            {overview.precision.staleCount > 0 && <span className="muted small block">{t('netWorth.stale', { count: overview.precision.staleCount })}</span>}
          </p>
        </div>
        {bs.unresolvedCount > 0 && <p className="muted small">{t('netWorth.unresolved', { count: bs.unresolvedCount })}</p>}
        {bs.missingFxCurrencies.length > 0 && (
          <p className="warn small">
            {t('netWorth.missingFx', { list: bs.missingFxCurrencies.join('、') })} <Link to="/settings">{t('nav.settings')}</Link>
          </p>
        )}
      </section>

      {target && targetItem && (
        <Link to={`/${target.kind}/${target.id}`} className="card next-step">
          <p className="eyebrow">{t('netWorth.nextStep')}</p>
          <p>
            {t(`netWorth.refine.${target.reason}`, { name: itemName(targetItem, target.kind, t) })}
          </p>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}

      {showIosInstall && (
        <section className="card tip">
          <p>{t('pwa.iosInstall')}</p>
          <button type="button" className="btn ghost small" onClick={() => dismissTip('ios_install')}>
            {t('common.dismiss')}
          </button>
        </section>
      )}

      {showBackup && bs.assets.length + bs.liabilities.length > 0 && (
        <Link to="/settings" className="card tip">
          <p>{lastBackupDays === null ? t('backup.remindNever') : t('backup.remindDays', { days: lastBackupDays })}</p>
        </Link>
      )}

      <ItemSection kind="asset" items={bs.assets} />
      <ItemSection kind="liability" items={bs.liabilities} />

      <LadderSummary />

      <div className="actions">
        <button
          type="button"
          className="btn primary"
          disabled={savingSnap}
          onClick={async () => {
            setSavingSnap(true);
            try {
              await recordSnapshot(repo, pack, data.household.id, 'manual');
            } finally {
              setSavingSnap(false);
            }
          }}
        >
          {todaySnap ? t('snapshot.updateToday') : t('snapshot.recordToday')}
        </button>
        <p className="muted small">{t('snapshot.hint')}</p>
      </div>

      <p className="disclaimer">{t('common.disclaimer')}</p>
    </div>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

export function itemName(item: Asset | Liability, kind: 'asset' | 'liability', t: T): string {
  return item.label || t(`category.${kind}.${item.category}`);
}

function ItemSection({ kind, items }: { kind: 'asset' | 'liability'; items: ResolvedItem<Asset | Liability>[] }) {
  const { t } = useTranslation();
  const { pack, data, today, overview } = useApp();
  const fmt = useFormat(pack);
  const defs = kind === 'asset' ? pack.categories.asset : pack.categories.liability;
  const total = kind === 'asset' ? overview.balanceSheet.totalAssets : overview.balanceSheet.totalLiabilities;

  const sorted = [...items].sort(
    (a, b) => defs.findIndex((d) => d.key === a.item.category) - defs.findIndex((d) => d.key === b.item.category) || (b.range?.mid ?? 0) - (a.range?.mid ?? 0),
  );

  return (
    <section className="card items">
      <header className="section-head">
        <h2>{t(`netWorth.section.${kind}`)}</h2>
        <span className="total">{fmt.money(total.mid)}</span>
      </header>
      {sorted.length === 0 && <p className="muted">{t(`netWorth.empty.${kind}`)}</p>}
      <ul className="item-list">
        {sorted.map(({ item, range, resolution }) => {
          const estimate = kind === 'asset' ? (item as Asset).value.estimate : (item as Liability).balance.estimate;
          const currency = kind === 'asset' ? (item as Asset).value.currency : (item as Liability).balance.currency;
          const icon = defs.find((d) => d.key === item.category)?.icon;
          return (
            <li key={item.id}>
              <Link to={`/${kind}/${item.id}`}>
                <span className="icon" aria-hidden="true">{icon}</span>
                <span className="name">
                  {itemName(item, kind, t)}
                  <ModeBadge estimate={estimate} today={today} staleAfterDays={data.settings.staleAfterDays} />
                </span>
                <span className="amount">
                  {range ? (
                    <>
                      {range.low !== range.high && <span className="approx-mark">{t('range.about')}</span>}
                      {fmt.money(range.mid)}
                      {currency !== data.household.baseCurrency && <small className="muted block">{currency}</small>}
                    </>
                  ) : resolution.status === 'missing_fx' ? (
                    <span className="muted">{t('netWorth.noFx')}</span>
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
        + {t(`netWorth.add.${kind}`)}
      </Link>
    </section>
  );
}
