import type { Table } from 'dexie';
import type { FinancialData } from '../core/overview';
import type { Repo } from '../data/repo';
import type { Assumptions, CheckIn, Goal, Holding, ID, Member, Snapshot, UserAction } from '../model/types';

export interface LoadedState {
  data: FinancialData | null;
  snapshots: Snapshot[];
  /** 未封存的理財目標，依優先順序排列 */
  goals: Goal[];
  /** 未封存的持股明細 */
  holdings: Holding[];
  userActions: UserAction[];
  /** 依日期排序 */
  checkIns: CheckIn[];
  assumptions?: Assumptions;
  primaryMember?: Member;
}

/** 讀取某個家庭的全部資料；家庭不存在（例如剛刪除全部資料）時 data 為 null */
export async function loadFinancialData(repo: Repo, householdId: ID): Promise<LoadedState> {
  const db = repo.db;
  const [household, settings] = await Promise.all([db.households.get(householdId), db.settings.get(householdId)]);
  if (!household || !settings) return { data: null, snapshots: [], goals: [], holdings: [], userActions: [], checkIns: [] };
  const by = <T extends { householdId: ID }>(t: Table<T, ID>) => t.where('householdId').equals(householdId).toArray();
  const [assets, liabilities, incomes, expenses, snapshots, goals, holdings, members, userActions, checkIns, assumptions] = await Promise.all([
    by(db.assets),
    by(db.liabilities),
    by(db.incomeItems),
    by(db.expenseItems),
    by(db.snapshots),
    by(db.goals),
    by(db.holdings),
    by(db.members),
    by(db.userActions),
    by(db.checkIns),
    db.assumptions.get(householdId),
  ]);
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  const activeGoals = goals.filter((g) => !g.archivedAt).sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
  return {
    data: { household, settings, assets, liabilities, incomes, expenses },
    snapshots,
    goals: activeGoals,
    holdings: holdings.filter((h) => !h.archivedAt),
    userActions: userActions.filter((a) => !a.archivedAt),
    checkIns: checkIns.filter((c) => !c.archivedAt).sort((a, b) => a.date.localeCompare(b.date)),
    assumptions,
    primaryMember: members.find((m) => m.isPrimary),
  };
}
