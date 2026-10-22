import { describe, expect, it } from 'vitest';
import { amortizedPayment, resolveDebt, simulatePayoff } from '../../src/core/debt';
import { twPack } from '../../src/locales/tw/pack';
import { ctx, liability } from '../helpers';

describe('amortizedPayment', () => {
  it('matches the standard formula', () => {
    // 100 萬、年利率 2.4%、20 年 ≈ 5,250
    expect(amortizedPayment(1_000_000, 0.024, 240)).toBeCloseTo(5250.4, 0);
  });
  it('handles zero rate and zero principal', () => {
    expect(amortizedPayment(1200, 0, 12)).toBe(100);
    expect(amortizedPayment(0, 0.05, 12)).toBe(0);
  });
});

describe('resolveDebt', () => {
  it('derives rate and payment from locale defaults', () => {
    const d = resolveDebt(liability({ mode: 'exact', value: 1_000_000, asOf: '2026-10-01' }, { category: 'mortgage', secured: true }), ctx, twPack)!;
    expect(d.rate.mid).toBe(0.022);
    expect(d.rateDerived).toBe(true);
    expect(d.paymentDerived).toBe(true);
    expect(d.payment.mid).toBeCloseTo(amortizedPayment(1_000_000, 0.022, 240));
    expect(d.isHighInterest).toBe(false);
  });

  it('uses user-entered rate and payment', () => {
    const d = resolveDebt(
      liability(
        { mode: 'range', low: 100_000, high: 200_000 },
        {
          category: 'personal_loan',
          annualRate: { mode: 'approx', value: 0.09, tolerance: 0 },
          monthlyPayment: { estimate: { mode: 'exact', value: 5000, asOf: '2026-10-01' }, currency: 'TWD' },
        },
      ),
      ctx,
      twPack,
    )!;
    expect(d.rate.mid).toBe(0.09);
    expect(d.payment).toEqual({ low: 5000, mid: 5000, high: 5000 });
    expect(d.isHighInterest).toBe(true);
  });

  it('a card paid in full every month has no payment or interest', () => {
    const paid = resolveDebt(liability({ mode: 'exact', value: 30000, asOf: '2026-10-01' }, { category: 'credit_card', isRevolving: false }), ctx, twPack)!;
    expect(paid.payment.mid).toBe(0);
    expect(paid.isHighInterest).toBe(false);
    const revolving = resolveDebt(liability({ mode: 'exact', value: 30000, asOf: '2026-10-01' }, { category: 'credit_card', isRevolving: true }), ctx, twPack)!;
    expect(revolving.isHighInterest).toBe(true);
    expect(revolving.payment.mid).toBeGreaterThan(0);
  });

  it('returns null when the balance is unknown', () => {
    expect(resolveDebt(liability({ mode: 'unknown' }), ctx, twPack)).toBeNull();
  });
});

describe('simulatePayoff', () => {
  const debts = [
    { id: 'card', balance: 50_000, annualRate: 0.15, minPayment: 2_000 },
    { id: 'small', balance: 10_000, annualRate: 0.02, minPayment: 500 },
    { id: 'loan', balance: 200_000, annualRate: 0.06, minPayment: 4_000 },
  ];

  it('avalanche pays less interest, snowball clears the smallest first', () => {
    const av = simulatePayoff(debts, 3000, 'avalanche');
    const sb = simulatePayoff(debts, 3000, 'snowball');
    expect(av.months).not.toBeNull();
    expect(sb.months).not.toBeNull();
    expect(av.totalInterest).toBeLessThan(sb.totalInterest);
    expect(sb.order[0]!.id).toBe('small');
    expect(av.order[0]!.id).toBe('card');
  });

  it('extra money shortens the payoff', () => {
    expect(simulatePayoff(debts, 5000, 'avalanche').months!).toBeLessThan(simulatePayoff(debts, 0, 'avalanche').months!);
  });

  it('never finishes when payments do not cover interest', () => {
    expect(simulatePayoff([{ id: 'x', balance: 100_000, annualRate: 0.15, minPayment: 1000 }], 0, 'avalanche', 120).months).toBeNull();
  });

  it('zero debts take zero months', () => {
    expect(simulatePayoff([], 0, 'snowball').months).toBe(0);
  });
});
