import { describe, expect, it } from 'vitest';
import { ladderPosition, levelFor } from '../../src/core/ladder';
import { twPack } from '../../src/locales/tw/pack';

const L = twPack.wealthLadder;
const WAN = 10_000;

describe('wealth ladder (TW, option A)', () => {
  it('maps net worth to levels', () => {
    expect(levelFor(-50 * WAN, L)).toBe(1);
    expect(levelFor(29 * WAN, L)).toBe(1);
    expect(levelFor(30 * WAN, L)).toBe(2);
    expect(levelFor(300 * WAN, L)).toBe(3);
    expect(levelFor(3000 * WAN, L)).toBe(4);
    expect(levelFor(3e8, L)).toBe(5);
    expect(levelFor(3e9, L)).toBe(6);
  });

  it('progress is linear in L1 and logarithmic above', () => {
    expect(ladderPosition({ low: 0, mid: 15 * WAN, high: 20 * WAN }, L).progress).toBeCloseTo(0.5);
    // 30萬 → 300萬 的幾何中點約 94.9 萬
    expect(ladderPosition({ low: 0, mid: Math.sqrt(30 * 300) * WAN, high: 100 * WAN }, L).progress).toBeCloseTo(0.5);
  });

  it('flags ranges spanning levels and negative net worth', () => {
    const p = ladderPosition({ low: -10 * WAN, mid: 20 * WAN, high: 50 * WAN }, L);
    expect(p.level).toBe(1);
    expect(p.spansLevels).toBe(true);
    expect(p.levelAtHigh).toBe(2);
    expect(ladderPosition({ low: -20, mid: -10, high: 0 }, L).isNegative).toBe(true);
  });

  it('top level has no next', () => {
    const p = ladderPosition({ low: 5e9, mid: 5e9, high: 5e9 }, L);
    expect(p.nextLevelMin).toBeNull();
    expect(p.progress).toBe(1);
  });
});

describe('ladder projection', () => {
  it('months to next level with savings and returns', async () => {
    const { monthsToNextLevel, worryFreeSpending } = await import('../../src/core/ladder');
    const pos = ladderPosition({ low: 100 * WAN, mid: 100 * WAN, high: 100 * WAN }, L);
    // 100 萬 → 300 萬，每月存 2 萬、零報酬：100 個月
    expect(monthsToNextLevel(pos, 100 * WAN, 2 * WAN, 0)).toBe(100);
    expect(monthsToNextLevel(pos, 100 * WAN, 2 * WAN, 0.03)!).toBeLessThan(100);
    expect(monthsToNextLevel(pos, 100 * WAN, 0, 0)).toBeNull();
    const top = ladderPosition({ low: 5e9, mid: 5e9, high: 5e9 }, L);
    expect(monthsToNextLevel(top, 5e9, 1, 0.03)).toBeNull();
    expect(worryFreeSpending(1_000_000)).toBe(100);
    expect(worryFreeSpending(-5)).toBe(0);
  });
});
