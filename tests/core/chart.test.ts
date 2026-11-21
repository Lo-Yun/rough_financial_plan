import { describe, expect, it } from 'vitest';
import { dayNumber, linearScale, nearestIndex, niceStep, niceTicks } from '../../src/core/chart';

describe('chart helpers', () => {
  it('linearScale maps domain to range and centers a flat domain', () => {
    const s = linearScale([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(50);
    expect(linearScale([3, 3], [0, 40])(3)).toBe(20);
  });

  it('niceStep picks 1, 2, 5 × 10^n', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(380_000)).toBe(500_000);
    expect(niceStep(7_000_000)).toBe(10_000_000);
  });

  it('niceTicks covers the data with round numbers', () => {
    const ticks = niceTicks(3_140_000, 9_650_000, 4);
    expect(ticks[0]).toBeLessThanOrEqual(3_140_000);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(9_650_000);
    expect(ticks).toEqual([2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000]);
  });

  it('niceTicks handles a single value and negatives', () => {
    expect(niceTicks(100, 100).length).toBeGreaterThan(1);
    const neg = niceTicks(-500, 200, 3);
    expect(neg[0]).toBeLessThanOrEqual(-500);
    expect(neg.at(-1)).toBeGreaterThanOrEqual(200);
  });

  it('dayNumber and nearestIndex', () => {
    expect(dayNumber('2026-01-02') - dayNumber('2026-01-01')).toBe(1);
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20], 16)).toBe(2);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});
