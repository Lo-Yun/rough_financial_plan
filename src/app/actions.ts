import { todayISO } from '../core/date';
import { buildSnapshotData, computeOverview, moneyContext } from '../core/overview';
import { holdingsEstimateForAsset, holdingsTotal } from '../core/portfolio';
import type { Repo } from '../data/repo';
import type { LocalePack } from '../model/localePack';
import type { ID, Snapshot } from '../model/types';
import { loadFinancialData } from './load';

/** 以資料庫中的最新資料建立今天的快照 */
export async function recordSnapshot(
  repo: Repo,
  pack: LocalePack,
  householdId: ID,
  trigger: Snapshot['trigger'],
): Promise<Snapshot | null> {
  const { data } = await loadFinancialData(repo, householdId);
  if (!data) return null;
  const today = todayISO();
  const overview = computeOverview(data, pack, today);
  const snap = await repo.saveSnapshot(householdId, buildSnapshotData(data, overview, pack, today, trigger));
  return snap;
}

/** 帳戶設定為「用持股加總」時，依目前持股更新帳戶價值 */
export async function syncAssetFromHoldings(repo: Repo, pack: LocalePack, householdId: ID, assetId: ID): Promise<void> {
  const { data, holdings } = await loadFinancialData(repo, householdId);
  const asset = data?.assets.find((a) => a.id === assetId);
  if (!data || !asset?.valueFromHoldings) return;
  const own = holdings.filter((h) => h.assetId === assetId);
  if (own.length === 0) return;
  const total = holdingsTotal(own, moneyContext(data, pack));
  const { id, householdId: _h, createdAt: _c, updatedAt: _u, ...rest } = asset;
  await repo.saveAsset(householdId, {
    ...rest,
    id,
    value: { estimate: holdingsEstimateForAsset(total, todayISO()), currency: data.household.baseCurrency },
  });
}
