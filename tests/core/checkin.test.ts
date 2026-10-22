import { describe, expect, it } from 'vitest';
import { computeBalanceSheet } from '../../src/core/balanceSheet';
import { addMonthsISO, compareSnapshots, isCheckInDue, nextCheckInDate, pickReviewItems } from '../../src/core/checkin';
import type { Snapshot } from '../../src/model/types';
import { asset, ctx, liability, settings } from '../helpers';

describe('dates', () => {
  it('adds months and clamps month ends', () => {
    expect(addMonthsISO('2026-10-22', 1)).toBe('2026-11-22');
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-11-15', 3)).toBe('2027-02-15');
    expect(nextCheckInDate('2026-10-22', 'quarterly')).toBe('2027-01-22');
    expect(nextCheckInDate('2026-10-22', 'off')).toBeUndefined();
  });
});

describe('isCheckInDue', () => {
  const base = { ...settings, onboardingCompletedAt: '2026-09-01T10:00:00Z' };
  it('uses the scheduled date when present', () => {
    expect(isCheckInDue({ ...base, nextCheckInDate: '2026-10-30' }, undefined, '2026-10-22')).toBe(false);
    expect(isCheckInDue({ ...base, nextCheckInDate: '2026-10-22' }, undefined, '2026-10-22')).toBe(true);
  });
  it('falls back to the last check-in or onboarding date', () => {
    expect(isCheckInDue(base, undefined, '2026-10-22')).toBe(true);
    expect(isCheckInDue(base, '2026-10-10', '2026-10-22')).toBe(false);
    expect(isCheckInDue({ ...base, onboardingCompletedAt: '2026-10-20T00:00:00Z' }, undefined, '2026-10-22')).toBe(false);
  });
  it('never due when turned off', () => {
    expect(isCheckInDue({ ...base, checkInFrequency: 'off' }, undefined, '2027-01-01')).toBe(false);
  });
});

describe('pickReviewItems', () => {
  it('takes the largest items plus stale and unknown ones without duplicates', () => {
    const today = '2026-10-22';
    const items = [
      asset({ mode: 'exact', value: 5_000_000, asOf: '2026-01-01' }, { id: 'home', category: 'real_estate', liquidity: 'illiquid' }),
      asset({ mode: 'approx', value: 300_000 }, { id: 'cash' }),
      asset({ mode: 'approx', value: 10_000 }, { id: 'small' }),
      asset({ mode: 'exact', value: 5_000, asOf: '2025-01-01' }, { id: 'old' }),
      asset({ mode: 'unknown' }, { id: 'unk' }),
    ];
    const bs = computeBalanceSheet(items, [liability({ mode: 'approx', value: 3_000_000 }, { id: 'mtg', category: 'mortgage' })], ctx);
    const r = pickReviewItems(bs, { today, staleAfterDays: 180 });
    expect(r.map((x) => x.id)).toEqual(['home', 'mtg', 'cash', 'old', 'unk']);
    expect(r.find((x) => x.id === 'home')!.reason).toBe('largest');
    expect(r.find((x) => x.id === 'old')!.reason).toBe('stale');
    expect(r.find((x) => x.id === 'unk')!.reason).toBe('unknown');
  });
});

describe('compareSnapshots', () => {
  const snap = (date: string, nw: number, precision: number, ladderLevel: number) =>
    ({ date, summary: { netWorth: { low: nw, mid: nw, high: nw }, precision, ladderLevel } }) as unknown as Snapshot;
  it('reports changes since the previous snapshot', () => {
    expect(compareSnapshots(snap('2026-09-22', 1_000_000, 0.5, 2), snap('2026-10-22', 1_050_000, 0.6, 2))).toEqual({
      netWorthChange: 50_000,
      precisionChange: expect.closeTo(0.1),
      levelChange: 0,
      days: 30,
    });
    expect(compareSnapshots(undefined, snap('2026-10-22', 1, 1, 1))).toBeNull();
  });
});
