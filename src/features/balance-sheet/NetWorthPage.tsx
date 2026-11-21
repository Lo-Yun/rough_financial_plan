import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { recordSnapshot } from '../../app/actions';
import { useApp, useFormat } from '../../app/context';
import { isEnabled } from '../../app/features';
import { isIOS, isStandalone } from '../../app/pwa';
import { daysBetween } from '../../core/date';
import { groupByCategory, type ResolvedItem } from '../../core/balanceSheet';
import { ModeBadge, PrecisionRing, RangeValue } from '../../components/Display';
import { IconBadge } from '../../components/Icon';
import { LineChart } from '../../components/LineChart';
import type { Asset, Liability, Range } from '../../model/types';
import { ActionsCard } from '../actions/ActionsCard';
import { LadderSummary } from './LadderSummary';

const BACKUP_REMIND_DAYS = 30;
/** 從沒備份過的話，開始使用滿這麼多天才提醒，讓新使用者先看到「下一步」 */
const BACKUP_GRACE_DAYS = 7;

export type Reminder = 'backup' | 'ios_install' | 'next_step';

/**
 * 淨值頁一次只放一張提醒卡。優先順序：
 * 1. 備份（注意色）：超過 30 天沒備份；從沒備份過且已使用滿 7 天
 * 2. iOS 加到主畫面（中性提示，可關閉）
 * 3. 下一步：把哪一項改精確
 */
export function pickReminder(o: {
  hasItems: boolean;
  lastBackupDays: number | null;
  householdAgeDays: number;
  showIosInstall: boolean;
  hasNextStep: boolean;
}): Reminder | null {
  const backupDue =
    o.hasItems && (o.lastBackupDays === null ? o.householdAgeDays >= BACKUP_GRACE_DAYS : o.lastBackupDays > BACKUP_REMIND_DAYS);
  if (backupDue) return 'backup';
  if (o.showIosInstall) return 'ios_install';
  if (o.hasNextStep) return 'next_step';
  return null;
}

export function NetWorthPage() {
  const { t } = useTranslation();
  const { overview, pack, data, snapshots, repo, today } = useApp();
  const [view, setView] = useState<'all' | 'accessible'>('all');
  const [savingSnap, setSavingSnap] = useState(false);
  const bs = overview.balanceSheet;
  const s = data.settings;
  const pct = Math.round(overview.precision.score * 100);
  const fmt = useFormat(pack);
  const approx = (r: Range) => (r.low !== r.high ? <span className="approx-mark">{t('range.about')}</span> : null);

  const target = overview.nextRefinement;
  const targetItem = target
    ? target.kind === 'asset'
      ? bs.assets.find((x) => x.item.id === target.id)?.item
      : bs.liabilities.find((x) => x.item.id === target.id)?.item
    : undefined;

  const todaySnap = snapshots.find((x) => x.date === today);
  const reminder = pickReminder({
    hasItems: bs.assets.length + bs.liabilities.length > 0,
    lastBackupDays: s.lastBackupAt ? daysBetween(s.lastBackupAt.slice(0, 10), today) : null,
    householdAgeDays: daysBetween(data.household.createdAt.slice(0, 10), today),
    showIosInstall: isIOS() && !isStandalone() && !s.dismissedTips.includes('ios_install'),
    hasNextStep: !!(target && targetItem),
  });

  const dismissTip = (id: string) => void repo.updateSettings(data.household.id, { dismissedTips: [...s.dismissedTips, id] });

  const accessible = view === 'accessible';
  const eqAssets = accessible ? bs.accessibleAssets : bs.totalAssets;
  const eqLiabilities = accessible ? bs.accessibleLiabilities : bs.totalLiabilities;

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
        <RangeValue range={accessible ? bs.accessibleNetWorth : bs.netWorth} pack={pack} size="lg" />
        <dl className="hero-equation">
          <div>
            <dt>{t('netWorth.equation.assets')}</dt>
            <dd>{approx(eqAssets)}{fmt.money(eqAssets.mid)}</dd>
          </div>
          <span className="op" aria-hidden="true">−</span>
          <div>
            <dt>{t('netWorth.equation.liabilities')}</dt>
            <dd>{approx(eqLiabilities)}{fmt.money(eqLiabilities.mid)}</dd>
          </div>
        </dl>
        {accessible && <p className="muted small">{t('netWorth.accessibleHint')}</p>}
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

      {isEnabled('actions') && <ActionsCard />}

      {/* 提醒一次只出現一張，依 pickReminder 的優先順序 */}
      {reminder === 'backup' && (
        <Link to="/settings" className="card attention">
          <p>{s.lastBackupAt ? t('backup.remindDays', { days: daysBetween(s.lastBackupAt.slice(0, 10), today) }) : t('backup.remindNever')}</p>
        </Link>
      )}

      {reminder === 'ios_install' && (
        <section className="card tip">
          <p>{t('pwa.iosInstall')}</p>
          <button type="button" className="btn ghost small" onClick={() => dismissTip('ios_install')}>
            {t('common.dismiss')}
          </button>
        </section>
      )}

      {reminder === 'next_step' && target && targetItem && (
        <Link to={`/${target.kind}/${target.id}`} className="card next-step">
          <p className="eyebrow">{t('netWorth.nextStep')}</p>
          <p>{t(`netWorth.refine.${target.reason}`, { name: itemName(targetItem, target.kind, t) })}</p>
          <span className="chevron" aria-hidden="true">›</span>
        </Link>
      )}

      <ItemSection kind="asset" items={bs.assets} />
      <ItemSection kind="liability" items={bs.liabilities} />

      <LadderSummary showLink={isEnabled('ladderPage')} />

      <TrendCard />

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
  const { pack, overview } = useApp();
  const fmt = useFormat(pack);
  const defs = kind === 'asset' ? pack.categories.asset : pack.categories.liability;
  const total = kind === 'asset' ? overview.balanceSheet.totalAssets : overview.balanceSheet.totalLiabilities;
  const groups = groupByCategory(items, defs.map((d) => d.key));

  return (
    <section className="card items">
      <header className="section-head">
        <h2>{t(`netWorth.section.${kind}`)}</h2>
        <span className="total">{fmt.money(total.mid)}</span>
      </header>
      {groups.length === 0 && <p className="muted">{t(`netWorth.empty.${kind}`)}</p>}
      <ul className="item-list">
        {groups.map((g) => {
          const icon = defs.find((d) => d.key === g.category)?.icon;
          if (g.items.length === 1) {
            return (
              <li key={g.category}>
                <ItemRow kind={kind} entry={g.items[0]!} icon={icon ?? ''} />
              </li>
            );
          }
          return (
            <li key={g.category} className="item-group">
              <div className="group-head">
                <IconBadge name={icon} />
                <span className="name">{t(`category.${kind}.${g.category}`)}</span>
                <span className="amount">
                  {g.subtotal ? (
                    <>
                      {g.subtotal.low !== g.subtotal.high && <span className="approx-mark">{t('range.about')}</span>}
                      {fmt.money(g.subtotal.mid)}
                    </>
                  ) : (
                    <span className="muted">？</span>
                  )}
                </span>
              </div>
              <ul className="item-list sub">
                {g.items.map((entry) => (
                  <li key={entry.item.id}>
                    <ItemRow kind={kind} entry={entry} />
                  </li>
                ))}
              </ul>
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

/** 一筆資產或負債；分組內的項目不顯示圖示（圖示在分組標題） */
function ItemRow({ kind, entry, icon }: { kind: 'asset' | 'liability'; entry: ResolvedItem<Asset | Liability>; icon?: string }) {
  const { t } = useTranslation();
  const { pack, data, today } = useApp();
  const fmt = useFormat(pack);
  const { item, range, resolution } = entry;
  const estimate = kind === 'asset' ? (item as Asset).value.estimate : (item as Liability).balance.estimate;
  const currency = kind === 'asset' ? (item as Asset).value.currency : (item as Liability).balance.currency;
  return (
    <Link to={`/${kind}/${item.id}`}>
      {icon !== undefined && <IconBadge name={icon} />}
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
  );
}

/** 淨值頁的小趨勢：近一年的快照（不足兩筆時用全部），點進去看完整歷史 */
function TrendCard() {
  const { t } = useTranslation();
  const { snapshots, pack, today } = useApp();
  const fmt = useFormat(pack);

  if (snapshots.length < 2) {
    return (
      <Link to="/history" className="card link-card">
        <span>{t('netWorth.historyLink')}</span>
        <span className="chevron" aria-hidden="true">›</span>
      </Link>
    );
  }

  const recent = snapshots.filter((x) => daysBetween(x.date, today) <= 365);
  const shown = recent.length >= 2 ? recent : snapshots;
  const first = shown[0]!;
  const last = shown.at(-1)!;
  const delta = last.summary.netWorth.mid - first.summary.netWorth.mid;
  const flat = Math.abs(delta) < Math.max(1, Math.abs(first.summary.netWorth.mid) * 0.005);
  const key = flat ? 'same' : delta > 0 ? 'up' : 'down';

  return (
    <Link to="/history" className="card trend-card">
      <div className="row-between">
        <h2>{t('netWorth.trend.title')}</h2>
        <span className="chevron" aria-hidden="true">›</span>
      </div>
      <LineChart
        compact
        height={64}
        points={shown.map((x) => ({ date: x.date, value: x.summary.netWorth.mid, low: x.summary.netWorth.low, high: x.summary.netWorth.high }))}
        formatValue={fmt.money}
      />
      <p className="muted small">{t(`netWorth.trend.${key}`, { date: first.date, amount: fmt.money(Math.abs(delta)) })}</p>
    </Link>
  );
}
