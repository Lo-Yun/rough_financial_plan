import type { LocalePack } from '../model/localePack';
import type { Assumptions, Goal, Holding, ISODate, UserAction } from '../model/types';
import { computeHealth } from './health';
import { computeMetrics, type Metrics } from './metrics';
import { moneyContext, type FinancialData, type Overview } from './overview';
import { analyzePortfolio, resolveTarget } from './portfolio';
import { buildActionBoard, evaluateRules, type ActionBoard, type Suggestion } from './rules';
import type { ResolvedAssumptions } from './planning';

export interface AdviceInput {
  data: FinancialData;
  overview: Overview;
  pack: LocalePack;
  goals: Goal[];
  holdings: Holding[];
  assumptions: ResolvedAssumptions;
  storedAssumptions?: Assumptions;
  age: number | null;
  snapshotCount: number;
  actions: UserAction[];
  today: ISODate;
}

export interface Advice {
  metrics: Metrics;
  suggestions: Suggestion[];
  board: ActionBoard;
}

/** 把健檢、投資組合、目標等結果整理成指標，再套用規則產生行動建議 */
export function computeAdvice(x: AdviceInput): Advice {
  const ctx = moneyContext(x.data, x.pack);
  const expenses = x.data.expenses.filter((e) => !e.archivedAt);
  const health = computeHealth(x.overview, expenses, x.pack, ctx, x.assumptions.safeWithdrawalRate);
  const portfolio = analyzePortfolio(x.overview.balanceSheet.assets, x.holdings, ctx, x.pack, !!x.data.settings.portfolioIncludeCash);
  const metrics = computeMetrics({
    overview: x.overview,
    health,
    portfolio,
    portfolioTarget: resolveTarget(x.storedAssumptions?.targetAllocation, x.pack, x.age),
    goals: x.goals,
    expenses,
    settings: x.data.settings,
    snapshotCount: x.snapshotCount,
    pack: x.pack,
  });
  const suggestions = evaluateRules(x.pack, metrics);
  return { metrics, suggestions, board: buildActionBoard(x.pack, suggestions, x.actions, x.today) };
}
