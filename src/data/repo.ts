import type { Table } from 'dexie';
import { ulid } from 'ulid';
import type {
  Asset,
  Assumptions,
  BaseEntity,
  ExpenseItem,
  Goal,
  Household,
  ID,
  IncomeItem,
  ISODate,
  Liability,
  Member,
  Settings,
  Snapshot,
} from '../model/types';
import type { LocalePack } from '../model/localePack';
import { AppDB, SCHEMA_VERSION } from './db';

/** 新增或更新時由呼叫端提供的欄位 */
export type Draft<T extends BaseEntity> = Omit<T, keyof BaseEntity> & { id?: ID };

export interface ExportPayload {
  household: Household;
  members: Member[];
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  assets: Asset[];
  liabilities: Liability[];
  snapshots: Snapshot[];
  goals: Goal[];
  settings: Settings;
  assumptions?: Assumptions;
}

function now(): string {
  return new Date().toISOString();
}

export function defaultSettings(householdId: ID, pack: LocalePack): Settings {
  return {
    householdId,
    language: pack.defaultLanguage,
    defaultTolerance: 0.15,
    staleAfterDays: 180,
    fxRates: [],
    checkInFrequency: 'monthly',
    pinLockEnabled: false,
    dismissedTips: [],
  };
}

export class Repo {
  constructor(readonly db: AppDB) {}

  /** 取得唯一的家庭；第一次使用時建立預設資料 */
  async ensureHousehold(pack: LocalePack): Promise<Household> {
    return this.db.transaction('rw', [this.db.households, this.db.members, this.db.settings], async () => {
      const existing = await this.db.households.toCollection().first();
      if (existing) return existing;
      const ts = now();
      const household: Household = {
        id: ulid(),
        name: '',
        localeCode: pack.code,
        baseCurrency: pack.baseCurrency,
        householdType: 'single',
        schemaVersion: SCHEMA_VERSION,
        createdAt: ts,
        updatedAt: ts,
      };
      await this.db.households.add(household);
      await this.db.members.add({
        id: ulid(),
        householdId: household.id,
        displayName: '',
        isPrimary: true,
        createdAt: ts,
        updatedAt: ts,
      });
      await this.db.settings.add(defaultSettings(household.id, pack));
      return household;
    });
  }

  async updateHousehold(id: ID, patch: Partial<Omit<Household, 'id'>>): Promise<void> {
    await this.db.households.update(id, { ...patch, updatedAt: now() });
  }

  async updatePrimaryMember(householdId: ID, patch: Partial<Omit<Member, 'id' | 'householdId'>>): Promise<void> {
    const m = await this.db.members.where('householdId').equals(householdId).filter((x) => x.isPrimary).first();
    if (m) await this.db.members.update(m.id, { ...patch, updatedAt: now() });
  }

  async updateSettings(householdId: ID, patch: Partial<Omit<Settings, 'householdId'>>): Promise<void> {
    await this.db.settings.update(householdId, patch);
  }

  private async save<T extends BaseEntity>(table: Table<T, ID>, householdId: ID, draft: Draft<T>): Promise<T> {
    const ts = now();
    const existing = draft.id ? await table.get(draft.id) : undefined;
    const row = {
      ...draft,
      id: draft.id ?? ulid(),
      householdId,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    } as T;
    await table.put(row);
    return row;
  }

  private async archive<T extends BaseEntity>(table: Table<T, ID>, id: ID): Promise<void> {
    const row = await table.get(id);
    if (!row) return;
    const ts = now();
    await table.put({ ...row, archivedAt: ts, updatedAt: ts });
  }

  saveAsset(householdId: ID, d: Draft<Asset>) {
    return this.save(this.db.assets, householdId, d);
  }
  saveLiability(householdId: ID, d: Draft<Liability>) {
    return this.save(this.db.liabilities, householdId, d);
  }
  saveIncome(householdId: ID, d: Draft<IncomeItem>) {
    return this.save(this.db.incomeItems, householdId, d);
  }
  saveExpense(householdId: ID, d: Draft<ExpenseItem>) {
    return this.save(this.db.expenseItems, householdId, d);
  }
  archiveAsset(id: ID) {
    return this.archive(this.db.assets, id);
  }
  archiveLiability(id: ID) {
    return this.archive(this.db.liabilities, id);
  }
  archiveIncome(id: ID) {
    return this.archive(this.db.incomeItems, id);
  }
  archiveExpense(id: ID) {
    return this.archive(this.db.expenseItems, id);
  }
  saveGoal(householdId: ID, d: Draft<Goal>) {
    return this.save(this.db.goals, householdId, d);
  }
  archiveGoal(id: ID) {
    return this.archive(this.db.goals, id);
  }

  /** 儲存使用者自訂的計算假設；欄位值為 undefined 代表改回預設 */
  async saveAssumptions(householdId: ID, patch: Partial<Omit<Assumptions, 'householdId'>>): Promise<void> {
    const existing = (await this.db.assumptions.get(householdId)) ?? { householdId };
    await this.db.assumptions.put({ ...existing, ...patch, householdId });
  }

  /** 同一天只保留一筆快照：已存在就覆蓋，保留原 id */
  async saveSnapshot(
    householdId: ID,
    data: Omit<Snapshot, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Snapshot> {
    const existing = await this.db.snapshots.where('[householdId+date]').equals([householdId, data.date]).first();
    const ts = now();
    const row: Snapshot = {
      ...data,
      id: existing?.id ?? ulid(),
      householdId,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    await this.db.snapshots.put(row);
    return row;
  }

  async deleteSnapshot(id: ID): Promise<void> {
    await this.db.snapshots.delete(id);
  }

  async snapshotDates(householdId: ID): Promise<ISODate[]> {
    return (await this.db.snapshots.where('householdId').equals(householdId).toArray()).map((s) => s.date);
  }

  /** 清除收支與資產負債（快速估算重新開始時使用），保留家庭與設定 */
  async clearFinancialItems(householdId: ID): Promise<void> {
    const tables = [this.db.incomeItems, this.db.expenseItems, this.db.assets, this.db.liabilities, this.db.snapshots, this.db.goals];
    await this.db.transaction('rw', tables, async () => {
      for (const t of tables) await t.where('householdId').equals(householdId).delete();
    });
  }

  async exportAll(): Promise<ExportPayload> {
    const household = await this.db.households.toCollection().first();
    if (!household) throw new Error('no_household');
    const by = <T extends { householdId: ID }>(t: Table<T, ID>) => t.where('householdId').equals(household.id).toArray();
    const settings = await this.db.settings.get(household.id);
    if (!settings) throw new Error('no_settings');
    return {
      household,
      members: await by(this.db.members),
      incomeItems: await by(this.db.incomeItems),
      expenseItems: await by(this.db.expenseItems),
      assets: await by(this.db.assets),
      liabilities: await by(this.db.liabilities),
      snapshots: await by(this.db.snapshots),
      goals: await by(this.db.goals),
      settings,
      assumptions: await this.db.assumptions.get(household.id),
    };
  }

  /** 以匯入資料完全取代目前資料 */
  async importAll(p: ExportPayload): Promise<void> {
    await this.db.transaction('rw', this.allTables(), async () => {
      await this.clearAllInTransaction();
      await this.db.households.add(p.household);
      await this.db.members.bulkAdd(p.members);
      await this.db.incomeItems.bulkAdd(p.incomeItems);
      await this.db.expenseItems.bulkAdd(p.expenseItems);
      await this.db.assets.bulkAdd(p.assets);
      await this.db.liabilities.bulkAdd(p.liabilities);
      await this.db.snapshots.bulkAdd(p.snapshots);
      await this.db.goals.bulkAdd(p.goals);
      await this.db.settings.add(p.settings);
      if (p.assumptions) await this.db.assumptions.add(p.assumptions);
    });
  }

  /** 刪除所有資料 */
  async deleteAll(): Promise<void> {
    await this.db.transaction('rw', this.allTables(), () => this.clearAllInTransaction());
    await this.db.meta.clear();
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }

  private allTables() {
    const d = this.db;
    return [d.households, d.members, d.incomeItems, d.expenseItems, d.assets, d.liabilities, d.snapshots, d.goals, d.settings, d.assumptions];
  }

  private async clearAllInTransaction() {
    for (const t of this.allTables()) await t.clear();
  }
}
