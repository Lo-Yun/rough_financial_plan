import { describe, expect, it } from 'vitest';
import { blankToUnknown, convertEstimate, resolveEstimate, withStatKey } from '../../src/core/estimate';
import { ctx } from '../helpers';

describe('resolveEstimate', () => {
  it('unknown uses statistics p25/p50/p75', () => {
    expect(resolveEstimate({ mode: 'unknown', statKey: 'expense.monthly_total.single' }, ctx)).toEqual({
      low: 18000,
      mid: 25000,
      high: 35000,
    });
  });

  it('unknown without statistic is null', () => {
    expect(resolveEstimate({ mode: 'unknown' }, ctx)).toBeNull();
    expect(resolveEstimate({ mode: 'unknown', statKey: 'nope' }, ctx)).toBeNull();
  });

  it('range uses midpoint and tolerates swapped bounds', () => {
    expect(resolveEstimate({ mode: 'range', low: 80, high: 50 }, ctx)).toEqual({ low: 50, mid: 65, high: 80 });
  });

  it('approx uses default or custom tolerance', () => {
    const r = resolveEstimate({ mode: 'approx', value: 100 }, ctx)!;
    expect(r.low).toBeCloseTo(85);
    expect(r.high).toBeCloseTo(115);
    expect(resolveEstimate({ mode: 'approx', value: 100, tolerance: 0.5 }, ctx)).toEqual({ low: 50, mid: 100, high: 150 });
  });

  it('exact is a point', () => {
    expect(resolveEstimate({ mode: 'exact', value: 7, asOf: '2026-01-01' }, ctx)).toEqual({ low: 7, mid: 7, high: 7 });
  });
});

describe('convertEstimate', () => {
  const today = '2026-10-22';
  it('range → approx keeps midpoint', () => {
    expect(convertEstimate({ mode: 'range', low: 50, high: 80 }, 'approx', ctx, today)).toEqual({ mode: 'approx', value: 65 });
  });
  it('approx → exact keeps value and stamps today', () => {
    expect(convertEstimate({ mode: 'approx', value: 9 }, 'exact', ctx, today)).toEqual({
      mode: 'exact',
      value: 9,
      asOf: today,
      source: 'manual',
    });
  });
  it('unknown with statistic → range uses statistic bounds', () => {
    expect(convertEstimate({ mode: 'unknown', statKey: 'expense.monthly_total.single' }, 'range', ctx, today)).toEqual({
      mode: 'range',
      low: 18000,
      high: 35000,
    });
  });
  it('same mode returns input', () => {
    const e = { mode: 'approx', value: 1 } as const;
    expect(convertEstimate(e, 'approx', ctx, today)).toBe(e);
  });
});

describe('blankToUnknown', () => {
  it('turns unselected input into unknown with stat key', () => {
    expect(blankToUnknown({ mode: 'range', low: 0, high: 0 }, 'k')).toEqual({ mode: 'unknown', statKey: 'k' });
    expect(blankToUnknown({ mode: 'approx', value: 0 })).toEqual({ mode: 'unknown', statKey: undefined });
  });
  it('keeps real answers', () => {
    expect(blankToUnknown({ mode: 'range', low: 0, high: 30000 })).toEqual({ mode: 'range', low: 0, high: 30000 });
    expect(blankToUnknown({ mode: 'unknown' }, 'k')).toEqual({ mode: 'unknown', statKey: 'k' });
  });
});

describe('withStatKey', () => {
  it('keeps an existing stat key when none is given', () => {
    expect(withStatKey({ mode: 'unknown', statKey: 'a' }, undefined)).toEqual({ mode: 'unknown', statKey: 'a' });
    expect(withStatKey({ mode: 'unknown' }, 'b')).toEqual({ mode: 'unknown', statKey: 'b' });
    expect(withStatKey({ mode: 'approx', value: 1 }, 'b')).toEqual({ mode: 'approx', value: 1 });
  });
});
