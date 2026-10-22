import type { Asset, Estimate, Liability, Settings, Household } from '../src/model/types';

let seq = 0;
const stamp = '2026-01-01T00:00:00.000Z';

export function asset(estimate: Estimate, extra: Partial<Asset> = {}): Asset {
  return {
    id: `a${++seq}`,
    householdId: 'h',
    createdAt: stamp,
    updatedAt: stamp,
    ownerId: 'joint',
    category: 'cash',
    liquidity: 'liquid',
    value: { estimate, currency: 'TWD' },
    ...extra,
  };
}

export function liability(estimate: Estimate, extra: Partial<Liability> = {}): Liability {
  return {
    id: `l${++seq}`,
    householdId: 'h',
    createdAt: stamp,
    updatedAt: stamp,
    ownerId: 'joint',
    category: 'personal_loan',
    secured: false,
    balance: { estimate, currency: 'TWD' },
    ...extra,
  };
}

export const household: Household = {
  id: 'h',
  name: 'test',
  localeCode: 'TW',
  baseCurrency: 'TWD',
  householdType: 'single',
  schemaVersion: 1,
  createdAt: stamp,
  updatedAt: stamp,
};

export const settings: Settings = {
  householdId: 'h',
  language: 'zh-TW',
  defaultTolerance: 0.15,
  staleAfterDays: 180,
  fxRates: [{ currency: 'USD', rateToBase: 32, asOf: '2026-10-01' }],
  checkInFrequency: 'monthly',
  pinLockEnabled: false,
  dismissedTips: [],
};

export const ctx = {
  statistics: {
    'expense.monthly_total.single': { p25: 18000, p50: 25000, p75: 35000, source: 't', year: 2024, quality: 'placeholder' as const, labelKey: 'x' },
  },
  defaultTolerance: 0.15,
  baseCurrency: 'TWD',
  fxRates: settings.fxRates,
};
