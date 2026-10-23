import { describe, expect, it } from 'vitest';
import { formatCompact, formatRange, groupDigits, parseAmount } from '../../src/core/format';
import { twPack } from '../../src/locales/tw/pack';

const units = [
  { value: 1e8, label: '億' },
  { value: 1e4, label: '萬' },
];
const aliases = twPack.inputUnitAliases;

describe('formatCompact', () => {
  it('uses 萬 and 億', () => {
    expect(formatCompact(5_600, units)).toBe('5,600');
    expect(formatCompact(56_000, units)).toBe('5.6 萬');
    expect(formatCompact(1_234_567, units)).toBe('123 萬');
    expect(formatCompact(250_000_000, units)).toBe('2.5 億');
    expect(formatCompact(-300_000, units)).toBe('-30 萬');
    expect(formatCompact(50_800, units)).toBe('5.1 萬');
  });
  it('formats ranges', () => {
    expect(formatRange({ low: 1e6, mid: 1.5e6, high: 2e6 }, units)).toBe('100 萬 ～ 200 萬');
    expect(formatRange({ low: 5, mid: 5, high: 5 }, units)).toBe('5');
  });
});

describe('parseAmount', () => {
  it('parses plain numbers and separators', () => {
    expect(parseAmount('123,456', aliases)).toBe(123456);
    expect(parseAmount(' 1 000 ', aliases)).toBe(1000);
  });
  it('parses units', () => {
    expect(parseAmount('600萬', aliases)).toBe(6_000_000);
    expect(parseAmount('1.2億', aliases)).toBe(120_000_000);
    expect(parseAmount('35k', aliases)).toBe(35_000);
    expect(parseAmount('35K', aliases)).toBe(35_000);
    expect(parseAmount('1億2000萬', aliases)).toBe(120_000_000);
    expect(parseAmount('3萬5000', aliases)).toBe(35_000);
  });
  it('rejects garbage', () => {
    expect(parseAmount('', aliases)).toBeNull();
    expect(parseAmount('abc', aliases)).toBeNull();
    expect(parseAmount('12萬abc', aliases)).toBeNull();
    expect(parseAmount('5 3萬', aliases)).toBe(530_000);
  });
});

describe('formatPercent', () => {
  it('uses one decimal below 10%', async () => {
    const { formatPercent, formatPercentRange } = await import('../../src/core/format');
    expect(formatPercent(0.153)).toBe('15%');
    expect(formatPercent(0.052)).toBe('5.2%');
    expect(formatPercent(-0.02)).toBe('-2%');
    expect(formatPercentRange({ low: 0.1, mid: 0.15, high: 0.2 })).toBe('10% ～ 20%');
  });
});

describe('groupDigits', () => {
  it('adds thousands separators to plain numbers', () => {
    expect(groupDigits('1234567')).toBe('1,234,567');
    expect(groupDigits('1,23,4567')).toBe('1,234,567');
    expect(groupDigits('-50000')).toBe('-50,000');
    expect(groupDigits('1234.5')).toBe('1,234.5');
    expect(groupDigits('1234.')).toBe('1,234.');
    expect(groupDigits('999')).toBe('999');
  });

  it('leaves other text as typed', () => {
    for (const s of ['45萬', '35k', '1萬2000', '', '-', '12,000元', 'abc']) expect(groupDigits(s)).toBe(s);
  });
});
