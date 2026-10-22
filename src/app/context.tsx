import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatPercent, formatPercentRange, formatRange, type DisplayUnit } from '../core/format';
import { moneyContext, type FinancialData, type Overview } from '../core/overview';
import type { PlanningContext, ResolvedAssumptions } from '../core/planning';
import type { Repo } from '../data/repo';
import type { LocalePack } from '../model/localePack';
import type { Assumptions, CheckIn, Goal, Holding, ISODate, Member, Range, Snapshot, UserAction } from '../model/types';
import { computeAdvice, type Advice } from '../core/advice';

export interface AppState {
  repo: Repo;
  pack: LocalePack;
  data: FinancialData;
  snapshots: Snapshot[];
  overview: Overview;
  today: ISODate;
  /** 未封存的理財目標，依優先順序 */
  goals: Goal[];
  /** 套用預設值後的計算假設 */
  assumptions: ResolvedAssumptions;
  /** 使用者自訂的假設（未自訂的欄位為 undefined） */
  storedAssumptions?: Assumptions;
  holdings: Holding[];
  primaryMember?: Member;
  userActions: UserAction[];
  /** 依日期排序 */
  checkIns: CheckIn[];
}

/** 依主要成員的出生年估算年齡；沒填時為 null */
export function ageOf(member: Member | undefined, today: ISODate): number | null {
  const by = member?.birthYear;
  if (!by || by.mode === 'unknown') return null;
  const year = by.mode === 'range' ? (by.low + by.high) / 2 : by.value;
  return Number(today.slice(0, 4)) - Math.round(year);
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}

/** 依地區資料包的單位格式化金額 */
export function useFormat(pack: LocalePack) {
  const { t } = useTranslation();
  return useMemo(() => {
    const units: DisplayUnit[] = pack.numberUnits.map((u) => ({ value: u.value, label: t(u.i18nKey) }));
    return {
      money: (n: number) => formatCompact(n, units),
      range: (r: Range) => formatRange(r, units),
      pct: formatPercent,
      pctRange: formatPercentRange,
      /** 月數 → 「3 年 2 個月」 */
      duration: (months: number) => {
        const y = Math.floor(months / 12);
        const m = months % 12;
        if (y === 0) return t('duration.months', { count: m });
        if (m === 0) return t('duration.years', { count: y });
        return t('duration.yearsMonths', { y, m });
      },
    };
  }, [pack, t]);
}

export function usePlanningContext(): PlanningContext {
  const { overview, data, pack, assumptions, today } = useApp();
  return useMemo(
    () => ({ overview, money: moneyContext(data, pack), assumptions, pack, today }),
    [overview, data, pack, assumptions, today],
  );
}

/** 行動建議與進行中的行動（P4） */
export function useAdvice(): Advice {
  const app = useApp();
  const { data, overview, pack, goals, holdings, assumptions, storedAssumptions, primaryMember, snapshots, userActions, today } = app;
  return useMemo(
    () =>
      computeAdvice({
        data,
        overview,
        pack,
        goals,
        holdings,
        assumptions,
        storedAssumptions,
        age: ageOf(primaryMember, today),
        snapshotCount: snapshots.length,
        actions: userActions,
        today,
      }),
    [data, overview, pack, goals, holdings, assumptions, storedAssumptions, primaryMember, snapshots.length, userActions, today],
  );
}

/** 行動參數都是金額，先格式化再交給 i18n 插值 */
export function useActionParams() {
  const { pack } = useApp();
  const fmt = useFormat(pack);
  return (params: Record<string, number> | undefined) =>
    Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, fmt.money(v)]));
}
