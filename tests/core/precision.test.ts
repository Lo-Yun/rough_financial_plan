import { describe, expect, it } from 'vitest';
import { isStale, precisionScore } from '../../src/core/precision';

const opts = { today: '2026-10-22', staleAfterDays: 180 };

describe('precisionScore', () => {
  it('is weighted by amount', () => {
    const r = precisionScore(
      [
        { estimate: { mode: 'exact', value: 900, asOf: '2026-10-01' }, magnitude: 900 },
        { estimate: { mode: 'range', low: 50, high: 150 }, magnitude: 100 },
      ],
      opts,
    );
    expect(r.score).toBeCloseTo((900 * 1 + 100 * 0.4) / 1000);
  });

  it('stale exact values count as approx', () => {
    const e = { mode: 'exact', value: 1, asOf: '2026-01-01' } as const;
    expect(isStale(e, opts)).toBe(true);
    const r = precisionScore([{ estimate: e, magnitude: 1 }], opts);
    expect(r.score).toBeCloseTo(0.75);
    expect(r.staleCount).toBe(1);
  });

  it('unresolved items weigh as the median known amount', () => {
    const r = precisionScore(
      [
        { estimate: { mode: 'exact', value: 100, asOf: '2026-10-01' }, magnitude: 100 },
        { estimate: { mode: 'unknown' }, magnitude: null },
      ],
      opts,
    );
    expect(r.score).toBeCloseTo(0.5);
    expect(r.unresolvedCount).toBe(1);
  });

  it('empty is 0; all unresolved is 0', () => {
    expect(precisionScore([], opts).score).toBe(0);
    expect(precisionScore([{ estimate: { mode: 'unknown' }, magnitude: null }], opts).score).toBe(0);
  });
});
