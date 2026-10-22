import { todayISO } from '../core/date';
import { buildSnapshotData, computeOverview } from '../core/overview';
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
