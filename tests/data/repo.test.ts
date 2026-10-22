import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from '../../src/data/db';
import { Repo } from '../../src/data/repo';
import { buildExport, parseExport, BackupError } from '../../src/data/backup';
import { twPack } from '../../src/locales/tw/pack';

let n = 0;
let repo: Repo;

beforeEach(() => {
  repo = new Repo(new AppDB(`test-${++n}`));
});

const cash = {
  ownerId: 'joint' as const,
  category: 'cash' as const,
  liquidity: 'liquid' as const,
  value: { estimate: { mode: 'approx' as const, value: 100_000 }, currency: 'TWD' },
};

describe('Repo', () => {
  it('ensureHousehold is idempotent and creates settings', async () => {
    const a = await repo.ensureHousehold(twPack);
    const b = await repo.ensureHousehold(twPack);
    expect(a.id).toBe(b.id);
    expect(await repo.db.settings.get(a.id)).toMatchObject({ defaultTolerance: 0.15 });
    expect(await repo.db.members.count()).toBe(1);
  });

  it('save creates then updates, keeping createdAt', async () => {
    const h = await repo.ensureHousehold(twPack);
    const created = await repo.saveAsset(h.id, cash);
    const updated = await repo.saveAsset(h.id, { ...cash, id: created.id, label: 'x' });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(await repo.db.assets.count()).toBe(1);
    await repo.archiveAsset(created.id);
    expect((await repo.db.assets.get(created.id))?.archivedAt).toBeTruthy();
  });

  it('keeps one snapshot per day', async () => {
    const h = await repo.ensureHousehold(twPack);
    const summary = {
      totalAssets: { low: 0, mid: 0, high: 0 },
      totalLiabilities: { low: 0, mid: 0, high: 0 },
      netWorth: { low: 0, mid: 0, high: 0 },
      accessibleNetWorth: { low: 0, mid: 0, high: 0 },
      precision: 0,
      byAssetCategory: {},
      byLiabilityCategory: {},
    };
    const base = { trigger: 'manual' as const, baseCurrency: 'TWD', summary, items: { assets: [], liabilities: [] }, fxRates: [], localePackVersion: 'x' };
    const s1 = await repo.saveSnapshot(h.id, { ...base, date: '2026-10-01' });
    const s2 = await repo.saveSnapshot(h.id, { ...base, date: '2026-10-01', trigger: 'check_in' });
    await repo.saveSnapshot(h.id, { ...base, date: '2026-10-02' });
    expect(s2.id).toBe(s1.id);
    expect(await repo.db.snapshots.count()).toBe(2);
  });

  it('export → import round trip, plain and encrypted', async () => {
    const h = await repo.ensureHousehold(twPack);
    await repo.saveAsset(h.id, cash);
    const payload = await repo.exportAll();

    const other = new Repo(new AppDB(`test-${++n}`));
    await other.ensureHousehold(twPack);

    const plain = await buildExport(payload, { appVersion: 't' });
    await other.importAll(await parseExport(plain));
    expect(await other.db.assets.count()).toBe(1);
    expect((await other.db.households.toArray()).map((x) => x.id)).toEqual([h.id]);

    const enc = await buildExport(payload, { appVersion: 't', password: 'secret' });
    expect(enc).not.toContain('100000');
    await expect(parseExport(enc)).rejects.toMatchObject({ code: 'needs_password' });
    await expect(parseExport(enc, 'wrong')).rejects.toBeInstanceOf(BackupError);
    expect((await parseExport(enc, 'secret')).assets).toHaveLength(1);
  });

  it('rejects files that are not exports', async () => {
    await expect(parseExport('{"hello":1}')).rejects.toMatchObject({ code: 'invalid_format' });
    await expect(parseExport('not json')).rejects.toMatchObject({ code: 'invalid_format' });
  });

  it('deleteAll wipes everything', async () => {
    const h = await repo.ensureHousehold(twPack);
    await repo.saveAsset(h.id, cash);
    await repo.setMeta('k', 'x');
    await repo.deleteAll();
    expect(await repo.db.households.count()).toBe(0);
    expect(await repo.db.assets.count()).toBe(0);
    expect(await repo.getMeta('k')).toBeUndefined();
  });
});

describe('schema v2', () => {
  it('saves goals and assumptions and exports them', async () => {
    const h = await repo.ensureHousehold(twPack);
    const g = await repo.saveGoal(h.id, { type: 'emergency_fund', priority: 1, status: 'active', params: { kind: 'emergency_fund', months: 6 } });
    await repo.saveAssumptions(h.id, { inflation: 0.03 });
    await repo.saveAssumptions(h.id, { safeWithdrawalRate: 0.035 });
    const p = await repo.exportAll();
    expect(p.goals.map((x) => x.id)).toEqual([g.id]);
    expect(p.assumptions).toMatchObject({ inflation: 0.03, safeWithdrawalRate: 0.035 });

    const other = new Repo(new AppDB(`test-${++n}`));
    await other.importAll(await parseExport(await buildExport(p, { appVersion: 't' })));
    expect(await other.db.goals.count()).toBe(1);
    expect((await other.db.assumptions.toArray())[0]?.inflation).toBe(0.03);
  });

  it('imports v1 backups by adding empty goals', async () => {
    const h = await repo.ensureHousehold(twPack);
    const p = await repo.exportAll();
    const { goals: _goals, assumptions: _a, holdings: _h, userActions: _u, checkIns: _c, ...v1 } = p;
    const text = JSON.stringify({ format: 'rough-financial-plan-export', schemaVersion: 1, exportedAt: '', appVersion: 'old', encrypted: false, payload: v1 });
    const migrated = await parseExport(text);
    expect(migrated.goals).toEqual([]);
    expect(migrated.holdings).toEqual([]);
    expect(migrated.household.id).toBe(h.id);
  });

  it('rejects backups from a newer schema', async () => {
    const text = JSON.stringify({ format: 'rough-financial-plan-export', schemaVersion: 99, exportedAt: '', appVersion: 'x', encrypted: false, payload: {} });
    await expect(parseExport(text)).rejects.toMatchObject({ code: 'unsupported_version' });
  });
});

describe('IndexedDB upgrade', () => {
  it('opens a database created by v1 and keeps its data', async () => {
    const name = `upgrade-${++n}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
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
    await v1.table('assets').put({ id: 'a1', householdId: 'h', ...cash, createdAt: '', updatedAt: '' });
    v1.close();

    const upgraded = new Repo(new AppDB(name));
    expect(await upgraded.db.assets.get('a1')).toMatchObject({ category: 'cash' });
    expect(await upgraded.db.goals.count()).toBe(0);
    expect(upgraded.db.verno).toBe(4);
    expect(await upgraded.db.userActions.count()).toBe(0);
    expect(await upgraded.db.holdings.count()).toBe(0);
  });
});

describe('schema v3', () => {
  it('saves holdings and round-trips them through a backup', async () => {
    const h = await repo.ensureHousehold(twPack);
    const a = await repo.saveAsset(h.id, { ...cash, category: 'investment', liquidity: 'semi_liquid' });
    await repo.saveHolding(h.id, { assetId: a.id, name: '0050', assetClass: 'equity_domestic', quantity: 100, price: { value: 150, currency: 'TWD', asOf: '2026-10-01' } });
    const p = await repo.exportAll();
    expect(p.holdings).toHaveLength(1);
    const other = new Repo(new AppDB(`test-${++n}`));
    await other.importAll(await parseExport(await buildExport(p, { appVersion: 't' })));
    expect(await other.db.holdings.count()).toBe(1);
  });

  it('migrates v2 backups by adding empty holdings', async () => {
    await repo.ensureHousehold(twPack);
    const { holdings: _h, userActions: _u, checkIns: _c, ...v2 } = await repo.exportAll();
    const text = JSON.stringify({ format: 'rough-financial-plan-export', schemaVersion: 2, exportedAt: '', appVersion: 'old', encrypted: false, payload: v2 });
    expect((await parseExport(text)).holdings).toEqual([]);
  });
});

describe('syncAssetFromHoldings', () => {
  it('updates the account value from its holdings only when enabled', async () => {
    const { syncAssetFromHoldings } = await import('../../src/app/actions');
    const h = await repo.ensureHousehold(twPack);
    const a = await repo.saveAsset(h.id, { ...cash, category: 'investment', liquidity: 'semi_liquid' });
    await repo.saveHolding(h.id, { assetId: a.id, name: 'A', assetClass: 'equity_domestic', quantity: 100, price: { value: 150, currency: 'TWD', asOf: '2026-10-01' } });
    await repo.saveHolding(h.id, { assetId: a.id, name: 'B', assetClass: 'bond', quantity: 10, price: { value: 1000, currency: 'TWD', asOf: '2026-10-05' } });

    await syncAssetFromHoldings(repo, twPack, h.id, a.id);
    expect((await repo.db.assets.get(a.id))!.value.estimate).toEqual({ mode: 'approx', value: 100_000 });

    await repo.saveAsset(h.id, { ...cash, id: a.id, category: 'investment', liquidity: 'semi_liquid', valueFromHoldings: true });
    await syncAssetFromHoldings(repo, twPack, h.id, a.id);
    expect((await repo.db.assets.get(a.id))!.value.estimate).toEqual({ mode: 'exact', value: 25_000, asOf: '2026-10-01', source: 'manual' });
  });
});

describe('schema v4', () => {
  it('saves actions and check-ins and round-trips them', async () => {
    const h = await repo.ensureHousehold(twPack);
    await repo.saveUserAction(h.id, { templateId: 'fix_deficit', status: 'active', acceptedAt: '2026-10-22T00:00:00Z' });
    await repo.saveCheckIn(h.id, { date: '2026-10-22', hadMajorChange: false, updatedItemIds: [], completedActionIds: [] });
    const p = await repo.exportAll();
    expect(p.userActions).toHaveLength(1);
    expect(p.checkIns).toHaveLength(1);
    const other = new Repo(new AppDB(`test-${++n}`));
    await other.importAll(await parseExport(await buildExport(p, { appVersion: 't' })));
    expect(await other.db.userActions.count()).toBe(1);
    expect(await other.db.checkIns.count()).toBe(1);
  });

  it('migrates v3 backups by adding empty actions and check-ins', async () => {
    await repo.ensureHousehold(twPack);
    const { userActions: _u, checkIns: _c, ...v3 } = await repo.exportAll();
    const text = JSON.stringify({ format: 'rough-financial-plan-export', schemaVersion: 3, exportedAt: '', appVersion: 'old', encrypted: false, payload: v3 });
    const migrated = await parseExport(text);
    expect(migrated.userActions).toEqual([]);
    expect(migrated.checkIns).toEqual([]);
  });
});
