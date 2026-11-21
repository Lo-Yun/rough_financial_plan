import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, parseFeatures } from '../../src/app/features';

describe('parseFeatures', () => {
  it('未設定或空白時是 v1：全部關閉', () => {
    expect(parseFeatures(undefined).size).toBe(0);
    expect(parseFeatures('').size).toBe(0);
  });

  it('all 開啟全部功能', () => {
    expect([...parseFeatures('all')].sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it('逗號分隔只開啟列出的功能，不認得的名稱略過', () => {
    expect([...parseFeatures(' cashflow, health ,nope')].sort()).toEqual(['cashflow', 'health']);
  });
});
