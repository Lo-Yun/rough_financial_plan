import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatRange, type DisplayUnit } from '../core/format';
import type { FinancialData, Overview } from '../core/overview';
import type { Repo } from '../data/repo';
import type { LocalePack } from '../model/localePack';
import type { ISODate, Range, Snapshot } from '../model/types';

export interface AppState {
  repo: Repo;
  pack: LocalePack;
  data: FinancialData;
  snapshots: Snapshot[];
  overview: Overview;
  today: ISODate;
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
    };
  }, [pack, t]);
}
