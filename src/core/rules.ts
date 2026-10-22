import type { ActionTemplate, Condition, Expression, LocalePack } from '../model/localePack';
import type { ISODate, ISODateTime, UserAction } from '../model/types';
import { daysBetween } from './date';
import type { Metrics } from './metrics';

// 行動建議規則引擎，見規格 4.9

/** 條件成立與否；指標無法計算時，比較條件一律不成立（只有 missing 會成立） */
export function evalCondition(c: Condition, m: Metrics): boolean {
  if ('all' in c) return c.all.every((x) => evalCondition(x, m));
  if ('any' in c) return c.any.some((x) => evalCondition(x, m));
  if ('not' in c) return !evalCondition(c.not, m);
  if ('missing' in c) return m[c.missing] === null || m[c.missing] === undefined;
  const v = m[c.metric];
  if (v === null || v === undefined) return false;
  switch (c.op) {
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
    default: {
      if (typeof v !== 'number' || typeof c.value !== 'number') return false;
      if (c.op === '<') return v < c.value;
      if (c.op === '<=') return v <= c.value;
      if (c.op === '>') return v > c.value;
      return v >= c.value;
    }
  }
}

/** 計算參數；任何一個指標無法計算就回傳 null */
export function evalExpression(e: Expression, m: Metrics): number | null {
  if ('const' in e) return e.const;
  if ('metric' in e) {
    const v = m[e.metric];
    return typeof v === 'number' ? v : null;
  }
  const args = e.args.map((a) => evalExpression(a, m));
  if (args.some((a) => a === null)) return null;
  const xs = args as number[];
  switch (e.op) {
    case '+':
      return xs.reduce((a, b) => a + b, 0);
    case '-':
      return xs.slice(1).reduce((a, b) => a - b, xs[0] ?? 0);
    case '*':
      return xs.reduce((a, b) => a * b, 1);
    case '/':
      return xs[1] ? xs[0]! / xs[1] : null;
    case 'max':
      return Math.max(...xs);
    case 'min':
      return Math.min(...xs);
    case 'round':
      // 取整到千元，金額比較好讀
      return Math.round(xs[0]! / 1000) * 1000;
  }
}

export interface Suggestion {
  template: ActionTemplate;
  params: Record<string, number>;
}

/** 依目前指標找出所有成立的建議，依優先順序排列 */
export function evaluateRules(pack: LocalePack, m: Metrics): Suggestion[] {
  const out: Suggestion[] = [];
  for (const rule of pack.actionRules) {
    if (!evalCondition(rule.when, m)) continue;
    const template = pack.actionTemplates.find((t) => t.id === rule.templateId);
    if (!template || out.some((s) => s.template.id === template.id)) continue;
    const params: Record<string, number> = {};
    let ok = true;
    for (const [k, expr] of Object.entries(rule.params ?? {})) {
      const v = evalExpression(expr, m);
      if (v === null) ok = false;
      else params[k] = v;
    }
    if (ok) out.push({ template, params });
  }
  return out.sort((a, b) => a.template.priority - b.template.priority);
}

export const MAX_ACTIVE = 3;
/** 選「之後再說」後，多久再提示 */
export const SNOOZE_DAYS = 30;
/** 完成後，同一個建議多久內不再出現 */
export const DONE_COOLDOWN_DAYS = 90;

export interface ActiveAction {
  action: UserAction;
  template?: ActionTemplate;
  /** 範本行動的條件已經不成立，可能已經做到了 */
  maybeDone: boolean;
}

export interface ActionBoard {
  active: ActiveAction[];
  /** 尚未處理的建議（不含進行中、已略過、冷卻中的） */
  suggestions: Suggestion[];
  done: UserAction[];
  dismissed: UserAction[];
  canAcceptMore: boolean;
}

function daysSince(ts: ISODateTime | undefined, today: ISODate): number {
  return ts ? daysBetween(ts.slice(0, 10), today) : Infinity;
}

/** 把即時算出的建議，和使用者已處理過的紀錄合併 */
export function buildActionBoard(pack: LocalePack, suggestions: Suggestion[], actions: UserAction[], today: ISODate): ActionBoard {
  const live = actions.filter((a) => !a.archivedAt);
  const activeRows = live.filter((a) => a.status === 'active');
  const suggestedIds = new Set(suggestions.map((s) => s.template.id));

  const hidden = (templateId: string) =>
    live.some((a) => {
      if (a.templateId !== templateId) return false;
      if (a.status === 'active') return true;
      if (a.status === 'done') return daysSince(a.completedAt, today) < DONE_COOLDOWN_DAYS;
      if (a.dismissReason === 'later') return daysSince(a.dismissedAt, today) < SNOOZE_DAYS;
      return true;
    });

  return {
    active: activeRows.map((action) => ({
      action,
      template: action.templateId ? pack.actionTemplates.find((t) => t.id === action.templateId) : undefined,
      maybeDone: !!action.templateId && !suggestedIds.has(action.templateId),
    })),
    suggestions: suggestions.filter((s) => !hidden(s.template.id)),
    done: live.filter((a) => a.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    dismissed: live.filter((a) => a.status === 'dismissed'),
    canAcceptMore: activeRows.length < MAX_ACTIVE,
  };
}
