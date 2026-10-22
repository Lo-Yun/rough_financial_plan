import type { LadderLevelDef } from '../model/localePack';
import type { Range } from '../model/types';
import { monthlyRate, monthsToTarget } from './planning';

export interface LadderPosition {
  /** 依淨值中間值判定的層級 */
  level: number;
  /** 淨值區間的低端、高端分別落在哪一層 */
  levelAtLow: number;
  levelAtHigh: number;
  spansLevels: boolean;
  /** 在本層內往下一層的進度 0–1；L1 用線性，其他層用對數（每層 10 倍） */
  progress: number;
  currentLevelMin: number;
  /** 下一層門檻；已在最高層時為 null */
  nextLevelMin: number | null;
  isNegative: boolean;
}

export function levelFor(netWorth: number, ladder: LadderLevelDef[]): number {
  let level = ladder[0]?.level ?? 1;
  for (const def of ladder) if (netWorth >= def.minNetWorth) level = def.level;
  return level;
}

export function ladderPosition(netWorth: Range, ladder: LadderLevelDef[]): LadderPosition {
  const x = netWorth.mid;
  const level = levelFor(x, ladder);
  const idx = ladder.findIndex((d) => d.level === level);
  const current = ladder[idx]!;
  const next = ladder[idx + 1];

  let progress = 1;
  if (next) {
    const lo = current.minNetWorth;
    if (!Number.isFinite(lo) || lo <= 0) {
      progress = Math.max(0, x) / next.minNetWorth;
    } else {
      progress = (Math.log10(x) - Math.log10(lo)) / (Math.log10(next.minNetWorth) - Math.log10(lo));
    }
  }

  const levelAtLow = levelFor(netWorth.low, ladder);
  const levelAtHigh = levelFor(netWorth.high, ladder);
  return {
    level,
    levelAtLow,
    levelAtHigh,
    spansLevels: levelAtLow !== levelAtHigh,
    progress: Math.min(1, Math.max(0, progress)),
    currentLevelMin: current.minNetWorth,
    nextLevelMin: next?.minNetWorth ?? null,
    isNegative: x < 0,
  };
}

/**
 * 照目前每月結餘與實質報酬，大約幾個月到下一層；已在最高層或照目前速度到不了時為 null。
 * 淨值為負時不計報酬（避免把負債當成會「成長」）。
 */
export function monthsToNextLevel(
  position: LadderPosition,
  netWorth: number,
  monthlySurplus: number | null,
  realAnnualReturn: number,
): number | null {
  if (position.nextLevelMin === null) return null;
  const i = netWorth > 0 ? monthlyRate(realAnnualReturn) : 0;
  return monthsToTarget(position.nextLevelMin, netWorth, Math.max(0, monthlySurplus ?? 0), i);
}

/** Maggiulli 的 0.01% 法則：低於淨值 × 0.01% 的日常花費，對財富幾乎沒有影響 */
export function worryFreeSpending(netWorth: number): number {
  return Math.max(0, netWorth * 0.0001);
}
