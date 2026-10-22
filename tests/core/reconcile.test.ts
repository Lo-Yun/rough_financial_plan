import { describe, expect, it } from 'vitest';
import { reconcile } from '../../src/core/reconcile';

const r = (low: number, high: number) => ({ low, mid: (low + high) / 2, high });

describe('reconcile', () => {
  it('ok when middle values are close', () => {
    expect(reconcile(r(20_000, 30_000), r(250_000, 400_000)).status).toBe('ok');
  });
  it('wide overlapping ranges are not enough to pass', () => {
    // 估算 -12 萬～ 60 萬（中間 24 萬）、實際約 8 萬：範圍重疊但中間值差很多
    expect(reconcile(r(-10_000, 50_000), r(70_000, 90_000)).status).toBe('expense_underestimated');
  });
  it('estimate far above reality means expenses are underestimated', () => {
    expect(reconcile(r(25_000, 25_000), r(50_000, 80_000)).status).toBe('expense_underestimated');
  });
  it('estimate far below reality means income is underestimated', () => {
    expect(reconcile(r(5_000, 5_000), r(300_000, 300_000)).status).toBe('income_underestimated');
  });
  it('close point estimates are ok', () => {
    expect(reconcile(r(20_000, 20_000), r(260_000, 260_000)).status).toBe('ok');
  });
});
