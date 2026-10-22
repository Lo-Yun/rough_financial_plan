import type {
  Asset,
  AssetCategory,
  CurrencyCode,
  ID,
  Liability,
  LiabilityCategory,
  Range,
} from '../model/types';
import { resolveMoney, type MoneyContext, type MoneyResolution } from './currency';
import { add, sub, sum, ZERO } from './interval';

export interface ResolvedItem<T> {
  item: T;
  resolution: MoneyResolution;
  /** 解析成功時的主要幣別區間 */
  range: Range | null;
}

export interface BalanceSheet {
  assets: ResolvedItem<Asset>[];
  liabilities: ResolvedItem<Liability>[];
  totalAssets: Range;
  totalLiabilities: Range;
  netWorth: Range;
  /** 不含難以變現資產（自住房、車、退休帳戶等）及其擔保負債 */
  accessibleNetWorth: Range;
  byAssetCategory: Partial<Record<AssetCategory, Range>>;
  byLiabilityCategory: Partial<Record<LiabilityCategory, Range>>;
  unresolvedCount: number;
  missingFxCurrencies: CurrencyCode[];
}

/** 可動用資產：不是難以變現，也不是自住房 */
export function isAccessibleAsset(a: Asset): boolean {
  return a.liquidity !== 'illiquid' && !a.isPrimaryResidence;
}

/** 沒有指定擔保品時，這些類別預設視為由難以變現的資產擔保 */
const DEFAULT_TIED_TO_ILLIQUID: LiabilityCategory[] = ['mortgage', 'car_loan'];

/** 負債是否由「不可動用」的資產擔保；是的話不計入可動用淨值 */
export function isTiedToInaccessibleAsset(l: Liability, assetsById: Map<ID, Asset>): boolean {
  const linked = l.securedByAssetId ? assetsById.get(l.securedByAssetId) : undefined;
  if (linked) return !isAccessibleAsset(linked);
  return DEFAULT_TIED_TO_ILLIQUID.includes(l.category);
}

function resolve<T>(item: T, money: Parameters<typeof resolveMoney>[0], ctx: MoneyContext): ResolvedItem<T> {
  const resolution = resolveMoney(money, ctx);
  return { item, resolution, range: resolution.status === 'ok' ? resolution.range : null };
}

function groupSum<K extends string, T>(
  items: ResolvedItem<T>[],
  key: (t: T) => K,
): Partial<Record<K, Range>> {
  const out: Partial<Record<K, Range>> = {};
  for (const r of items) {
    if (!r.range) continue;
    const k = key(r.item);
    out[k] = add(out[k] ?? ZERO, r.range);
  }
  return out;
}

export function computeBalanceSheet(
  assets: Asset[],
  liabilities: Liability[],
  ctx: MoneyContext,
): BalanceSheet {
  const activeAssets = assets.filter((a) => !a.archivedAt);
  const activeLiabilities = liabilities.filter((l) => !l.archivedAt);
  const assetsById = new Map(activeAssets.map((a) => [a.id, a]));

  const ra = activeAssets.map((a) => resolve(a, a.value, ctx));
  const rl = activeLiabilities.map((l) => resolve(l, l.balance, ctx));

  const ranges = <T>(xs: ResolvedItem<T>[]) => xs.flatMap((x) => (x.range ? [x.range] : []));

  const totalAssets = sum(ranges(ra));
  const totalLiabilities = sum(ranges(rl));
  const accessibleAssets = sum(ranges(ra.filter((x) => isAccessibleAsset(x.item))));
  const accessibleLiabilities = sum(
    ranges(rl.filter((x) => !isTiedToInaccessibleAsset(x.item, assetsById))),
  );

  const all = [...ra, ...rl];
  const missingFx = new Set<CurrencyCode>();
  for (const x of all) if (x.resolution.status === 'missing_fx') missingFx.add(x.resolution.currency);

  return {
    assets: ra,
    liabilities: rl,
    totalAssets,
    totalLiabilities,
    netWorth: sub(totalAssets, totalLiabilities),
    accessibleNetWorth: sub(accessibleAssets, accessibleLiabilities),
    byAssetCategory: groupSum(ra, (a) => a.category),
    byLiabilityCategory: groupSum(rl, (l) => l.category),
    unresolvedCount: all.filter((x) => x.range === null).length,
    missingFxCurrencies: [...missingFx],
  };
}
