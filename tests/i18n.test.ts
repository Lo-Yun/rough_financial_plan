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
      ...['weekly', 'monthly', 'quarterly', 'yearly'].flatMap((f) => [`frequency.${f}`, `cashflow.amountPer.${f}`]),
      ...['income', 'expense'].flatMap((k) => [`cashflow.section.${k}`, `cashflow.empty.${k}`, `cashflow.add.${k}`, `cashflow.labelPlaceholder.${k}`]),
      ...['ok', 'expense_underestimated', 'income_underestimated'].map((x) => `reconcile.result.${x}`),
      ...['red', 'yellow', 'green', 'none'].map((x) => `health.light.${x}`),
      ...['higher', 'lower'].map((x) => `health.goal.${x}`),
      ...['no_income', 'no_expense', 'no_housing', 'no_insurance'].map((x) => `health.missing.${x}`),
      ...Object.keys(twPack.healthThresholds).flatMap((k) => ['name', 'explain', 'action', 'cta'].map((f) => `health.metric.${k}.${f}`)),
      'health.metric.savings_rate.excellent',
      'health.metric.emergency_months.excellent',
      'health.metric.emergency_months.too_high',
      ...['emergency_fund', 'debt_payoff', 'home_down_payment', 'retirement_fi', 'education', 'big_purchase', 'custom'].flatMap((g) => [
        `plans.type.${g}.name`,
        `plans.type.${g}.desc`,
      ]),
      ...['avalanche', 'snowball'].flatMap((s) => [`plans.strategy.${s}`, `plans.strategy.${s}Hint`]),
      ...['cash', 'balanced', 'growth'].flatMap((p) => [`plans.profile.${p}.name`, `plans.profile.${p}.desc`]),
      ...['emergency_fund', 'retirement_fi', 'other'].map((x) => `plans.field.linkedHint.${x}`),
      ...['user', 'surplus'].map((x) => `plans.proj.contribution.${x}`),
      ...['green', 'yellow', 'red'].map((x) => `plans.home.ratio.${x}`),
      ...twPack.forgottenExpenses,
      ...['equity', 'bond', 'cash', 'alternative'].map((g) => `portfolio.groupName.${g}`),
      ...['equity_domestic', 'equity_global', 'bond', 'cash', 'real_estate', 'crypto', 'insurance', 'other'].map((c) => `portfolio.class.${c}`),
      ...[1, 2, 3, 4, 5].map((l) => `portfolio.risk.level${l}`),
      ...twPack.allocationPresets.flatMap((p) => [p.i18nKey, `portfolio.presetDesc.${p.id}`]),
      ...['holdings', 'user', 'default', 'guessed'].map((x) => `portfolio.source.${x}`),
      ...['priced', 'value'].map((x) => `holdings.mode.${x}`),
      ...twPack.actionTemplates.flatMap((tpl) => ['title', 'why', 'how'].map((f) => `${tpl.i18nKey}.${f}`)),
      ...['not_relevant', 'later', 'already_done'].map((r) => `actions.reason.${r}`),
      ...['largest', 'stale', 'unknown'].map((r) => `checkin.review.reason.${r}`),
      ...['same', 'updated'].map((x) => `checkin.review.${x}`),
      ...[1, 2, 3, 4, 5].map((m) => `checkin.feel.mood${m}`),
      ...['monthly', 'quarterly', 'off'].map((f) => `settings.checkin.${f}`),
      ...[1, 2, 3, 4, 5, 6].flatMap((l) => [`ladder.level${l}.name`, `ladder.level${l}.desc`]),
      ...Object.values(twPack.statistics).map((st) => st.labelKey),
      ...['official', 'derived', 'placeholder'].map((q) => `stats.quality.${q}`),
    ];
    expect(dynamic.filter((k) => !has(k))).toEqual([]);
  });
});
