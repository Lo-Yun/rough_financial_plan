import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import zhTW from '../src/locales/tw/zh-TW.json';
import { twPack } from '../src/locales/tw/pack';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

function has(key: string): boolean {
  let node: unknown = zhTW;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

describe('zh-TW translations', () => {
  it('has every literal key used in t()', () => {
    const missing: string[] = [];
    for (const f of files('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) {
        if (!has(m[1]!)) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has every key referenced by the locale pack', () => {
    const keys = [
      ...twPack.numberUnits.map((u) => u.i18nKey),
      ...Object.values(twPack.categories).flatMap((cs) => cs.map((c) => c.i18nKey)),
      ...twPack.wealthLadder.flatMap((l) => [`${l.i18nKey}.name`, `${l.i18nKey}.desc`]),
    ];
    expect(keys.filter((k) => !has(k))).toEqual([]);
  });

  it('has keys for each dynamic section and mode', () => {
    const dynamic = [
      ...['unknown', 'range', 'approx', 'exact'].map((m) => `estimate.mode.${m}`),
      ...['asset', 'liability'].flatMap((k) => [`netWorth.section.${k}`, `netWorth.empty.${k}`, `netWorth.add.${k}`]),
      ...['unknown', 'stale', 'imprecise'].map((r) => `netWorth.refine.${r}`),
      ...['liquid', 'semi_liquid', 'illiquid'].flatMap((l) => [`liquidity.${l}`, `liquidity.${l}Hint`]),
      ...['manual', 'check_in', 'onboarding'].map((x) => `snapshot.trigger.${x}`),
      ...['invalid_format', 'needs_password', 'wrong_password', 'unsupported_version'].map((x) => `backup.error.${x}`),
      ...['all', 'accessible'].map((x) => `netWorth.view.${x}`),
    ];
    expect(dynamic.filter((k) => !has(k))).toEqual([]);
  });
});
