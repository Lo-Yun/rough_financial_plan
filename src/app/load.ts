import type { Table } from 'dexie';
import type { FinancialData } from '../core/overview';
import type { Repo } from '../data/repo';
import type { ID, Snapshot } from '../model/types';

export interface LoadedState {
  data: FinancialData | null;
  snapshots: Snapshot[];
}

/** 讀取某個家庭的全部資料；家庭不存在（例如剛刪除全部資料）時 data 為 null */
export async function loadFinancialData(repo: Repo, householdId: ID): Promise<LoadedState> {
  const db = repo.db;
  const [household, settings] = await Promise.all([db.households.get(householdId), db.settings.get(householdId)]);
  if (!household || !settings) return { data: null, snapshots: [] };
  const by = <T extends { householdId: ID }>(t: Table<T, ID>) => t.where('householdId').equals(householdId).toArray();
  const [assets, liabilities, incomes, expenses, snapshots] = await Promise.all([
    by(db.assets),
    by(db.liabilities),
    by(db.incomeItems),
    by(db.expenseItems),
    by(db.snapshots),
  ]);
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return { data: { household, settings, assets, liabilities, incomes, expenses }, snapshots };
}
