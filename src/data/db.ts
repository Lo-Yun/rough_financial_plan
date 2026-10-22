import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  ExpenseItem,
  Household,
  ID,
  IncomeItem,
  Liability,
  Member,
  Settings,
  Snapshot,
  Assumptions,
} from '../model/types';

export const SCHEMA_VERSION = 1;

export interface MetaRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  households!: Table<Household, ID>;
  members!: Table<Member, ID>;
  incomeItems!: Table<IncomeItem, ID>;
  expenseItems!: Table<ExpenseItem, ID>;
  assets!: Table<Asset, ID>;
  liabilities!: Table<Liability, ID>;
  snapshots!: Table<Snapshot, ID>;
  settings!: Table<Settings, ID>;
  assumptions!: Table<Assumptions, ID>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'rough-financial-plan') {
    super(name);
    // 見 docs/02-data-model.md 第 5 節；holdings、goals、userActions、checkIns 於後續版本加入
    this.version(SCHEMA_VERSION).stores({
      households: 'id',
      members: 'id, householdId',
      incomeItems: 'id, householdId, category, archivedAt',
      expenseItems: 'id, householdId, category, archivedAt',
      assets: 'id, householdId, category, archivedAt',
      liabilities: 'id, householdId, category, archivedAt',
      snapshots: 'id, householdId, &[householdId+date], date',
      settings: 'householdId',
      assumptions: 'householdId',
      meta: 'key',
    });
  }
}
