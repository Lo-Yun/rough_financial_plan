import type { LocalePack } from '../model/localePack';
import type {
  AllocationGroup,
  Asset,
  AssetCategory,
  AssetClass,
  CurrencyCode,
  Holding,
  ID,
  ISODate,
  Range,
  TargetAllocation,
} from '../model/types';
import type { ResolvedItem } from './balanceSheet';
import { resolveMoney, type MoneyContext } from './currency';
import { sum } from './interval';

// 投資組合儀表板，見規格 4.7。配置比例一律用中間值計算。

export const ASSET_CLASSES: AssetClass[] = [
  'equity_domestic',
  'equity_global',
  'bond',
  'cash',
  'real_estate',
  'crypto',
  'insurance',
  'other',
];

export const ALLOCATION_GROUPS: AllocationGroup[] = ['equity', 'bond', 'cash', 'alternative'];

export const CLASS_GROUP: Record<AssetClass, AllocationGroup> = {
  equity_domestic: 'equity',
  equity_global: 'equity',
  bond: 'bond',
  cash: 'cash',
  real_estate: 'alternative',
  crypto: 'alternative',
  insurance: 'alternative',
  other: 'alternative',
};

/** 預設配置只是猜測、需要提醒使用者確認的資產類別 */
const GUESSED_DEFAULT: AssetCategory[] = ['investment', 'retirement'];

type Allocation = Partial<Record<AssetClass, number>>;

/** 去掉非正值並讓總和為 1；全部為 0 時回傳 null */
export function normalizeAllocation(a: Allocation | undefined): Allocation | null {
  if (!a) return null;
  const entries = Object.entries(a).filter(([, v]) => typeof v === 'number' && v > 0) as [AssetClass, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return null;
  return Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
}

/** 單筆持股的市值（主要幣別）：有股數與現價就相乘，否則用估算市值 */
export function holdingValue(h: Holding, ctx: MoneyContext): Range | null {
  if (h.quantity !== undefined && h.price) {
    const r = resolveMoney(
      { estimate: { mode: 'exact', value: h.quantity * h.price.value, asOf: h.price.asOf }, currency: h.price.currency },
      ctx,
    );
    return r.status === 'ok' ? r.range : null;
  }
  if (h.marketValue) {
    const r = resolveMoney(h.marketValue, ctx);
    return r.status === 'ok' ? r.range : null;
  }
  return null;
}

export interface HoldingsTotal {
  total: Range;
  unresolvedCount: number;
  /** 全部都是「股數 × 現價」，可以視為精確值 */
  allPriced: boolean;
  /** 最舊的現價日期 */
  oldestPriceDate?: ISODate;
}

export function holdingsTotal(holdings: Holding[], ctx: MoneyContext): HoldingsTotal {
  const active = holdings.filter((h) => !h.archivedAt);
  const values = active.map((h) => holdingValue(h, ctx));
  const dates = active.flatMap((h) => (h.quantity !== undefined && h.price ? [h.price.asOf] : [])).sort();
  return {
    total: sum(values.flatMap((v) => (v ? [v] : []))),
    unresolvedCount: values.filter((v) => !v).length,
    allPriced: active.length > 0 && active.every((h) => h.quantity !== undefined && !!h.price),
    oldestPriceDate: dates[0],
  };
}

export interface PortfolioItem {
  asset: Asset;
  value: Range;
  allocation: Allocation;
  source: 'holdings' | 'user' | 'default';
  /** 預設配置只是猜測，建議使用者確認 */
  guessed: boolean;
  holdings: { holding: Holding; value: Range | null }[];
}

export interface Concentration {
  name: string;
  share: number;
  holdingId?: ID;
  assetId: ID;
}

export interface PortfolioAnalysis {
  items: PortfolioItem[];
  total: Range;
  /** 各資產類別的金額（中間值） */
  byClass: Partial<Record<AssetClass, number>>;
  classShare: Partial<Record<AssetClass, number>>;
  groupShare: Record<AllocationGroup, number>;
  currencyShare: Partial<Record<CurrencyCode, number>>;
  concentration: Concentration[];
  risk: { level: 1 | 2 | 3 | 4 | 5; growthShare: number };
  guessedCount: number;
  /** 列入投資組合但金額未知的資產數 */
  unresolvedCount: number;
  /** 金額未知的投資帳戶，仍列出讓使用者補金額或新增持股 */
  unresolvedAssets: Asset[];
}

export function isInPortfolio(asset: Asset, pack: LocalePack, includeCash: boolean): boolean {
  if (asset.archivedAt) return false;
  if (asset.category === 'cash') return includeCash;
  return pack.categories.asset.find((c) => c.key === asset.category)?.inPortfolio ?? false;
}

export function analyzePortfolio(
  assets: ResolvedItem<Asset>[],
  holdings: Holding[],
  ctx: MoneyContext,
  pack: LocalePack,
  includeCash: boolean,
): PortfolioAnalysis {
  const items: PortfolioItem[] = [];
  const unresolvedAssets: Asset[] = [];

  for (const { item: asset, range } of assets) {
    if (!isInPortfolio(asset, pack, includeCash)) continue;
    if (!range) {
      unresolvedAssets.push(asset);
      continue;
    }
    const hs = holdings.filter((h) => h.assetId === asset.id && !h.archivedAt).map((holding) => ({ holding, value: holdingValue(holding, ctx) }));

    let allocation: Allocation | null = null;
    let source: PortfolioItem['source'] = 'default';
    const priced = hs.filter((h) => h.value && h.value.mid > 0);
    if (priced.length) {
      const byClass: Allocation = {};
      for (const h of priced) byClass[h.holding.assetClass] = (byClass[h.holding.assetClass] ?? 0) + h.value!.mid;
      allocation = normalizeAllocation(byClass);
      source = 'holdings';
    }
    if (!allocation) {
      allocation = normalizeAllocation(asset.allocation);
      if (allocation) source = 'user';
    }
    if (!allocation) {
      allocation = normalizeAllocation(pack.categories.asset.find((c) => c.key === asset.category)?.defaultAllocation) ?? { other: 1 };
      source = 'default';
    }
    items.push({ asset, value: range, allocation, source, guessed: source === 'default' && GUESSED_DEFAULT.includes(asset.category), holdings: hs });
  }

  const total = sum(items.map((i) => i.value));
  const byClass: Partial<Record<AssetClass, number>> = {};
  const currencyAmount: Partial<Record<CurrencyCode, number>> = {};
  for (const i of items) {
    for (const [cls, share] of Object.entries(i.allocation) as [AssetClass, number][]) {
      byClass[cls] = (byClass[cls] ?? 0) + i.value.mid * share;
    }
    currencyAmount[i.asset.value.currency] = (currencyAmount[i.asset.value.currency] ?? 0) + i.value.mid;
  }

  const share = <K extends string>(m: Partial<Record<K, number>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, total.mid > 0 ? (v as number) / total.mid : 0])) as Partial<Record<K, number>>;
  const classShare = share(byClass);
  const groupShare: Record<AllocationGroup, number> = { equity: 0, bond: 0, cash: 0, alternative: 0 };
  for (const [cls, s] of Object.entries(classShare) as [AssetClass, number][]) groupShare[CLASS_GROUP[cls]] += s;

  const concentration: Concentration[] = [];
  if (total.mid > 0) {
    for (const i of items) {
      for (const h of i.holdings) {
        const s = (h.value?.mid ?? 0) / total.mid;
        if (s > pack.concentrationLimit) concentration.push({ name: h.holding.name, share: s, holdingId: h.holding.id, assetId: i.asset.id });
      }
    }
    concentration.sort((a, b) => b.share - a.share);
  }

  // 股票與加密資產的比例越高，波動越大；加密資產加重計算
  const growthShare = Math.min(1, groupShare.equity + (classShare.crypto ?? 0) * 1.5);
  const level = (growthShare < 0.2 ? 1 : growthShare < 0.4 ? 2 : growthShare < 0.6 ? 3 : growthShare < 0.8 ? 4 : 5) as PortfolioAnalysis['risk']['level'];

  return {
    items,
    total,
    byClass,
    classShare,
    groupShare,
    currencyShare: share(currencyAmount),
    concentration,
    risk: { level, growthShare },
    guessedCount: items.filter((i) => i.guessed).length,
    unresolvedCount: unresolvedAssets.length,
    unresolvedAssets,
  };
}

export type ResolvedTarget =
  | { status: 'none' }
  | { status: 'needs_age'; presetId: string }
  | { status: 'ok'; allocation: Record<AllocationGroup, number>; presetId?: string };

export function resolveTarget(target: TargetAllocation | undefined, pack: LocalePack, age: number | null): ResolvedTarget {
  if (!target) return { status: 'none' };
  if ('custom' in target) {
    const total = ALLOCATION_GROUPS.reduce((s, g) => s + Math.max(0, target.custom[g] ?? 0), 0);
    if (total <= 0) return { status: 'none' };
    const allocation = Object.fromEntries(ALLOCATION_GROUPS.map((g) => [g, Math.max(0, target.custom[g] ?? 0) / total])) as Record<AllocationGroup, number>;
    return { status: 'ok', allocation };
  }
  const preset = pack.allocationPresets.find((p) => p.id === target.preset);
  if (!preset) return { status: 'none' };
  if ('allocation' in preset) return { status: 'ok', allocation: preset.allocation, presetId: preset.id };
  if (age === null) return { status: 'needs_age', presetId: preset.id };
  const cash = preset.ageRule.cash;
  const equity = Math.min(0.95 - cash, Math.max(0.1, (preset.ageRule.base - age) / 100));
  return { status: 'ok', allocation: { equity, bond: Math.max(0, 1 - equity - cash), cash, alternative: 0 }, presetId: preset.id };
}

export interface Deviation {
  group: AllocationGroup;
  actual: number;
  target: number;
  /** actual − target */
  diff: number;
  /** 需要調整的金額（中間值）：正數代表超出目標 */
  amount: number;
  outOfBand: boolean;
}

export function deviations(a: PortfolioAnalysis, target: Record<AllocationGroup, number>, band: number): { items: Deviation[]; needsRebalance: boolean } {
  const items = ALLOCATION_GROUPS.map((group) => {
    const actual = a.groupShare[group];
    const diff = actual - target[group];
    return { group, actual, target: target[group], diff, amount: diff * a.total.mid, outOfBand: Math.abs(diff) > band + 1e-9 };
  });
  return { items, needsRebalance: items.some((d) => d.outOfBand) };
}

/** 依持股加總產生帳戶價值的估算值：全部有現價時視為精確值 */
export function holdingsEstimateForAsset(t: HoldingsTotal, today: ISODate) {
  if (t.allPriced) return { mode: 'exact' as const, value: Math.round(t.total.mid), asOf: t.oldestPriceDate ?? today, source: 'manual' as const };
  if (t.total.low === t.total.high) return { mode: 'approx' as const, value: Math.round(t.total.mid) };
  return { mode: 'range' as const, low: Math.round(t.total.low), high: Math.round(t.total.high) };
}
