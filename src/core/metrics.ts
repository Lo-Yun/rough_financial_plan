import type { ExpenseItem, Goal, GoalType, Settings } from '../model/types';
import type { HealthReport } from './health';
import { add } from './interval';
import type { Overview } from './overview';
import type { PortfolioAnalysis, ResolvedTarget } from './portfolio';
import { deviations } from './portfolio';
import type { LocalePack } from '../model/localePack';

// 行動建議規則可以使用的指標（P4）。值為 null 代表無法計算。
// 新增指標時，記得更新 docs/04-project-map.md 的指標清單。

export type MetricValue = number | boolean | null;
export type Metrics = Record<string, MetricValue>;

const GOAL_TYPES: GoalType[] = ['emergency_fund', 'debt_payoff', 'home_down_payment', 'retirement_fi', 'education', 'big_purchase', 'custom'];

export interface MetricsInput {
  overview: Overview;
  health: HealthReport;
  portfolio: PortfolioAnalysis;
  portfolioTarget: ResolvedTarget;
  goals: Goal[];
  expenses: ExpenseItem[];
  settings: Settings;
  snapshotCount: number;
  pack: LocalePack;
}

export function computeMetrics(m: MetricsInput): Metrics {
  const o = m.overview;
  const out: Metrics = {};

  for (const metric of m.health.metrics) out[`health.${metric.key}`] = metric.value ? metric.value.mid : null;
  out['health.fi_progress'] = m.health.fi.progress ? m.health.fi.progress.mid : null;

  out['ladder.level'] = o.ladder.level;
  out['ladder.negative'] = o.ladder.isNegative;

  out['precision.overall'] = o.precision.score;
  out['precision.unresolved_count'] = o.precision.unresolvedCount;
  out['precision.stale_count'] = o.precision.staleCount;

  out['cashflow.income'] = o.income.total ? o.income.total.mid : null;
  out['cashflow.expense'] = o.expense.total ? o.expense.total.mid : null;
  out['cashflow.surplus'] = o.surplus ? o.surplus.mid : null;
  out['cashflow.monthly_outflow'] = o.expense.total ? add(o.expense.total, o.debtPayments).mid : null;

  const revolving = o.debts.filter((d) => d.liability.category === 'credit_card' && d.liability.isRevolving);
  out['debt.count'] = o.debts.length;
  out['debt.revolving_total'] = revolving.reduce((s, d) => s + d.balance.mid, 0);
  out['debt.high_interest_total'] = o.debts.filter((d) => d.isHighInterest).reduce((s, d) => s + d.balance.mid, 0);

  const activeExpenses = m.expenses.filter((e) => !e.archivedAt);
  out['expense.item_count'] = activeExpenses.length;
  out['expense.has_insurance'] = activeExpenses.some((e) => e.category === 'insurance');

  out['reconcile.done'] = !!m.settings.reconciliation;

  out['portfolio.invested'] = m.portfolio.total.mid;
  out['portfolio.guessed_count'] = m.portfolio.guessedCount;
  out['portfolio.target_set'] = m.portfolioTarget.status !== 'none';
  out['portfolio.needs_rebalance'] =
    m.portfolioTarget.status === 'ok' && m.portfolio.total.mid > 0
      ? deviations(m.portfolio, m.portfolioTarget.allocation, m.pack.rebalanceBand).needsRebalance
      : false;

  for (const t of GOAL_TYPES) out[`goal.${t}.exists`] = m.goals.some((g) => g.type === t && g.status === 'active');
  out['goal.count'] = m.goals.length;

  out['snapshot.count'] = m.snapshotCount;
  return out;
}
