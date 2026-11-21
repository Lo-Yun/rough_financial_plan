import { describe, expect, it } from 'vitest';
import { pickReminder } from '../../src/features/balance-sheet/NetWorthPage';

const base = { hasItems: true, lastBackupDays: 3, householdAgeDays: 100, showIosInstall: false, hasNextStep: true };

describe('pickReminder：淨值頁一次只放一張提醒卡', () => {
  it('超過 30 天沒備份時，備份優先', () => {
    expect(pickReminder({ ...base, lastBackupDays: 31, showIosInstall: true })).toBe('backup');
    expect(pickReminder({ ...base, lastBackupDays: 30 })).toBe('next_step');
  });

  it('從沒備份過：使用滿 7 天才提醒，之前先顯示下一步', () => {
    expect(pickReminder({ ...base, lastBackupDays: null, householdAgeDays: 0 })).toBe('next_step');
    expect(pickReminder({ ...base, lastBackupDays: null, householdAgeDays: 7 })).toBe('backup');
  });

  it('沒有任何項目時不提醒備份', () => {
    expect(pickReminder({ ...base, hasItems: false, lastBackupDays: null, hasNextStep: false })).toBeNull();
  });

  it('iOS 安裝提示排在下一步之前', () => {
    expect(pickReminder({ ...base, showIosInstall: true })).toBe('ios_install');
    expect(pickReminder({ ...base, hasNextStep: false })).toBeNull();
  });
});
