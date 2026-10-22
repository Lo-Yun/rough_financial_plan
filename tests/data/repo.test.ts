import 'fake-indexeddb/auto';
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
    expect(await repo.db.settings.get(a.id)).toMatchObject({ analyticsEnabled: true, defaultTolerance: 0.15 });
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
    await repo.setMeta('installId', 'x');
    await repo.deleteAll();
    expect(await repo.db.households.count()).toBe(0);
    expect(await repo.db.assets.count()).toBe(0);
    expect(await repo.getMeta('installId')).toBeUndefined();
  });
});
