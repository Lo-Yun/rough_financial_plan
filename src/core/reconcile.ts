import type { Range } from '../model/types';
import { scale } from './interval';

// 對帳檢查，見規格 4.3：用「過去一年存款實際增加多少」檢驗收支估算

export interface ReconcileResult {
  status: 'ok' | 'expense_underestimated' | 'income_underestimated';
  /** 依收支估算的年結餘 */
  estimatedAnnual: Range;
  actual: Range;
}

/**
 * 比較兩者的中間值，差距在 tolerance 以內就視為對得上。
 * 不用「範圍有重疊」判斷：粗估的範圍通常很寬，幾乎都會重疊，檢查就失去意義。
 */
export function reconcile(monthlySurplus: Range, actualAnnual: Range, tolerance = 0.3): ReconcileResult {
  const estimatedAnnual = scale(monthlySurplus, 12);
  const base = Math.max(Math.abs(estimatedAnnual.mid), Math.abs(actualAnnual.mid), 1);
  if (Math.abs(estimatedAnnual.mid - actualAnnual.mid) / base <= tolerance) return { status: 'ok', estimatedAnnual, actual: actualAnnual };
  return {
    status: estimatedAnnual.mid > actualAnnual.mid ? 'expense_underestimated' : 'income_underestimated',
    estimatedAnnual,
    actual: actualAnnual,
  };
}
