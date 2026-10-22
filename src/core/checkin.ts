import type { ID, ISODate, Settings, Snapshot } from '../model/types';
import type { BalanceSheet } from './balanceSheet';
import { estimateWeight, isStale } from './precision';

// 定期回顧，見規格 4.10

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3 } as const;

/** 日期加上 n 個月；月底會落在目標月份的最後一天 */
export function addMonthsISO(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${String(tm).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

export function nextCheckInDate(from: ISODate, frequency: Settings['checkInFrequency']): ISODate | undefined {
  return frequency === 'off' ? undefined : addMonthsISO(from, FREQUENCY_MONTHS[frequency]);
}

/**
 * 是否該做回顧。沒有排定日期時，以最後一次回顧（或完成快速估算的日期）加上頻率推算，
 * 避免剛完成快速估算就被提醒。
 */
export function isCheckInDue(settings: Settings, lastCheckInDate: ISODate | undefined, today: ISODate): boolean {
  if (settings.checkInFrequency === 'off') return false;
  const base = lastCheckInDate ?? settings.onboardingCompletedAt?.slice(0, 10);
  const due = settings.nextCheckInDate ?? (base ? nextCheckInDate(base, settings.checkInFrequency) : undefined);
  return !!due && today >= due;
}

export interface ReviewItem {
  kind: 'asset' | 'liability';
  id: ID;
  reason: 'largest' | 'stale' | 'unknown';
}

/** 回顧時要確認的項目：金額最大的幾項，加上過期或未知的項目 */
export function pickReviewItems(bs: BalanceSheet, opts: { today: ISODate; staleAfterDays: number }, largest = 3): ReviewItem[] {
  const rows = [
    ...bs.assets.map((r) => ({ kind: 'asset' as const, id: r.item.id, range: r.range, estimate: r.item.value.estimate })),
    ...bs.liabilities.map((r) => ({ kind: 'liability' as const, id: r.item.id, range: r.range, estimate: r.item.balance.estimate })),
  ];
  const out: ReviewItem[] = [];
  const add = (item: ReviewItem) => {
    if (!out.some((x) => x.id === item.id)) out.push(item);
  };
  [...rows]
    .filter((r) => r.range)
    .sort((a, b) => Math.abs(b.range!.mid) - Math.abs(a.range!.mid))
    .slice(0, largest)
    .forEach((r) => add({ kind: r.kind, id: r.id, reason: 'largest' }));
  for (const r of rows) {
    if (isStale(r.estimate, opts)) add({ kind: r.kind, id: r.id, reason: 'stale' });
    else if (!r.range || estimateWeight(r.estimate, opts) === 0) add({ kind: r.kind, id: r.id, reason: 'unknown' });
  }
  return out;
}

export interface SnapshotDiff {
  netWorthChange: number;
  precisionChange: number;
  levelChange: number;
  days: number;
}

export function compareSnapshots(prev: Snapshot | undefined, cur: Snapshot): SnapshotDiff | null {
  if (!prev) return null;
  const days = Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / 86_400_000);
  return {
    netWorthChange: cur.summary.netWorth.mid - prev.summary.netWorth.mid,
    precisionChange: cur.summary.precision - prev.summary.precision,
    levelChange: (cur.summary.ladderLevel ?? 0) - (prev.summary.ladderLevel ?? 0),
    days,
  };
}
