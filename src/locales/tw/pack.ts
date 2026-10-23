import type { Bracket, LocalePack, StatEntry } from '../../model/localePack';

const WAN = 10_000;
const YI = 100_000_000;

/** 以「萬」為單位建立級距，id 例如 'cash_10_30w' */
function wanBrackets(prefix: string, edges: number[]): Bracket[] {
  const out: Bracket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const low = edges[i]!;
    const high = edges[i + 1]!;
    out.push({ id: `${prefix}_${low}_${high}w`, low: low * WAN, high: high * WAN });
  }
  return out;
}

// 「不確定」時代入的統計值。來源與換算方式見 docs/05-roadmap.md 的 T1。
const FIES = '行政院主計總處 113 年家庭收支調查';
const FIES_TABLE = `${FIES}報告第 5 表（家庭組織型態別）`;

/** 家庭收支調查的每月花費：中間值已扣除自用住宅設算租金，範圍為 ±25% */
function fies(mid: number, group: string, yearlyWan: number, imputedRentWan: number, labelKey: string): StatEntry {
  return {
    p25: Math.round((mid * 0.75) / 500) * 500,
    p50: mid,
    p75: Math.round((mid * 1.25) / 500) * 500,
    source: FIES_TABLE,
    year: 2024,
    quality: 'derived',
    note: `${group}每年消費支出 ${yearlyWan} 萬元，扣除自用住宅設算租金 ${imputedRentWan} 萬元後 ÷ 12；範圍為中間值 ±25% 的估計`,
    labelKey,
  };
}
const EARNINGS = '行政院主計總處 113 年受僱員工經常性薪資及全年總薪資統計';

export const twPack: LocalePack = {
  code: 'TW',
  version: '2026.10.0',
  baseCurrency: 'TWD',
  defaultLanguage: 'zh-TW',
  commonCurrencies: ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'AUD'],
  numberUnits: [
    { value: YI, i18nKey: 'unit.yi' },
    { value: WAN, i18nKey: 'unit.wan' },
  ],
  inputUnitAliases: { 億: YI, 萬: WAN, 万: WAN, w: WAN, 千: 1_000, k: 1_000 },

  categories: {
    income: [
      { key: 'salary', i18nKey: 'category.income.salary' },
      { key: 'bonus', i18nKey: 'category.income.bonus' },
      { key: 'side_hustle', i18nKey: 'category.income.side_hustle' },
      { key: 'business', i18nKey: 'category.income.business' },
      { key: 'rental', i18nKey: 'category.income.rental' },
      { key: 'dividend_interest', i18nKey: 'category.income.dividend_interest' },
      { key: 'pension', i18nKey: 'category.income.pension' },
      { key: 'other', i18nKey: 'category.income.other' },
    ],
    expense: [
      { key: 'housing', i18nKey: 'category.expense.housing' },
      { key: 'utilities', i18nKey: 'category.expense.utilities' },
      { key: 'food', i18nKey: 'category.expense.food' },
      { key: 'transport', i18nKey: 'category.expense.transport' },
      { key: 'telecom', i18nKey: 'category.expense.telecom' },
      { key: 'insurance', i18nKey: 'category.expense.insurance' },
      { key: 'children_education', i18nKey: 'category.expense.children_education' },
      { key: 'medical', i18nKey: 'category.expense.medical' },
      { key: 'family_support', i18nKey: 'category.expense.family_support' },
      { key: 'leisure_travel', i18nKey: 'category.expense.leisure_travel' },
      { key: 'shopping', i18nKey: 'category.expense.shopping' },
      { key: 'annual_irregular', i18nKey: 'category.expense.annual_irregular' },
      { key: 'other', i18nKey: 'category.expense.other' },
    ],
    asset: [
      { key: 'cash', i18nKey: 'category.asset.cash', icon: 'cash', defaultLiquidity: 'liquid', defaultAllocation: { cash: 1 }, inPortfolio: false },
      { key: 'investment', i18nKey: 'category.asset.investment', icon: 'investment', defaultLiquidity: 'semi_liquid', defaultAllocation: { equity_domestic: 1 }, inPortfolio: true },
      { key: 'crypto', i18nKey: 'category.asset.crypto', icon: 'crypto', defaultLiquidity: 'semi_liquid', defaultAllocation: { crypto: 1 }, inPortfolio: true },
      { key: 'retirement', i18nKey: 'category.asset.retirement', icon: 'retirement', defaultLiquidity: 'illiquid', defaultAllocation: { other: 1 }, inPortfolio: true },
      { key: 'insurance_cash_value', i18nKey: 'category.asset.insurance_cash_value', icon: 'insurance', defaultLiquidity: 'illiquid', defaultAllocation: { insurance: 1 }, inPortfolio: true },
      { key: 'real_estate', i18nKey: 'category.asset.real_estate', icon: 'home', defaultLiquidity: 'illiquid', defaultAllocation: { real_estate: 1 }, inPortfolio: false },
      { key: 'vehicle', i18nKey: 'category.asset.vehicle', icon: 'car', defaultLiquidity: 'illiquid', defaultAllocation: { other: 1 }, inPortfolio: false },
      { key: 'receivable', i18nKey: 'category.asset.receivable', icon: 'receivable', defaultLiquidity: 'semi_liquid', defaultAllocation: { other: 1 }, inPortfolio: false },
      { key: 'other', i18nKey: 'category.asset.other', icon: 'box', defaultLiquidity: 'semi_liquid', defaultAllocation: { other: 1 }, inPortfolio: false },
    ],
    liability: [
      { key: 'mortgage', i18nKey: 'category.liability.mortgage', icon: 'home', defaultSecured: true, defaultAnnualRate: 0.022, defaultTermMonths: 240 },
      { key: 'car_loan', i18nKey: 'category.liability.car_loan', icon: 'car', defaultSecured: true, defaultAnnualRate: 0.04, defaultTermMonths: 60 },
      { key: 'personal_loan', i18nKey: 'category.liability.personal_loan', icon: 'bank', defaultSecured: false, defaultAnnualRate: 0.06, defaultTermMonths: 84 },
      { key: 'credit_card', i18nKey: 'category.liability.credit_card', icon: 'creditCard', defaultSecured: false, defaultAnnualRate: 0.15, defaultTermMonths: 24 },
      { key: 'student_loan', i18nKey: 'category.liability.student_loan', icon: 'graduation', defaultSecured: false, defaultAnnualRate: 0.018, defaultTermMonths: 96 },
      { key: 'family_loan', i18nKey: 'category.liability.family_loan', icon: 'family', defaultSecured: false, defaultAnnualRate: 0, defaultTermMonths: 60 },
      { key: 'business_loan', i18nKey: 'category.liability.business_loan', icon: 'store', defaultSecured: false, defaultAnnualRate: 0.04, defaultTermMonths: 84 },
      { key: 'other', i18nKey: 'category.liability.other', icon: 'document', defaultSecured: false, defaultAnnualRate: 0.05, defaultTermMonths: 60 },
    ],
  },

  brackets: {
    monthly_income: wanBrackets('inc', [0, 3, 5, 8, 12, 20, 40]),
    monthly_expense: wanBrackets('exp', [0, 2, 3, 5, 8, 12, 20]),
    cash: wanBrackets('cash', [0, 10, 30, 100, 300, 1000, 3000]),
    investment: wanBrackets('inv', [0, 10, 30, 100, 300, 1000, 3000]),
    real_estate: wanBrackets('re', [0, 500, 1000, 1500, 2500, 4000, 8000]),
    vehicle: wanBrackets('veh', [0, 30, 60, 100, 200]),
    mortgage: wanBrackets('mtg', [0, 300, 600, 1000, 1500, 2500]),
    debt: wanBrackets('debt', [0, 10, 50, 100, 300, 500]),
    generic_asset: wanBrackets('ga', [0, 10, 50, 100, 300, 1000]),
  },

  statistics: {
    // 113 年家庭收支調查第 5 表（家庭組織型態別）：每戶每年消費支出扣除「自用住宅設算租金」後 ÷ 12。
    // 設算租金是住自己房子「假想要付的房租」，不是實際花出去的錢，扣掉才接近使用者感受到的每月花費。
    // 報告沒有提供四分位數，P25／P75 暫以中間值 ±25% 估計。
    //   單人 443,148 − 53,924；夫婦 717,998 − 79,692；核心家庭 1,145,751 − 95,319；
    //   單親 737,457 − 65,398；全體平均 888,699 − 79,968（「其他」包含三代同堂、祖孫等，用全體平均）
    'expense.monthly_total.single': fies(32_500, '單人家庭', 44.3, 5.4, 'stats.label.expense_single'),
    'expense.monthly_total.couple': fies(53_000, '夫婦家庭', 71.8, 8.0, 'stats.label.expense_couple'),
    'expense.monthly_total.couple_with_children': fies(87_500, '核心家庭（夫婦與未婚子女）', 114.6, 9.5, 'stats.label.expense_couple_with_children'),
    'expense.monthly_total.single_parent': fies(56_000, '單親家庭', 73.7, 6.5, 'stats.label.expense_single_parent'),
    'expense.monthly_total.other': fies(67_500, '全體家庭平均', 88.9, 8.0, 'stats.label.expense_other'),
    // 經常性薪資中位數 37,274 元（稅前）；P25、P75 依全年總薪資的四分位比例（40.6／54.6、84.2／54.6）換算；
    // 再扣除約 5% 的勞健保自付額，換成「實際拿到手」的金額
    'income.monthly_salary.per_earner': {
      p25: 26_000,
      p50: 35_000,
      p75: 55_000,
      source: EARNINGS,
      year: 2024,
      quality: 'derived',
      note: '經常性薪資中位數 37,274 元 × 0.95（勞健保自付）；P25／P75 依全年總薪資四分位數與中位數的比例換算',
      labelKey: 'stats.label.income_salary',
    },
  },

  // 依 Maggiulli《The Wealth Ladder》的 10 倍分層，以 1 USD ≈ 30 TWD 換算取整（方案 A）
  wealthLadder: [
    { level: 1, minNetWorth: Number.NEGATIVE_INFINITY, i18nKey: 'ladder.level1' },
    { level: 2, minNetWorth: 30 * WAN, i18nKey: 'ladder.level2' },
    { level: 3, minNetWorth: 300 * WAN, i18nKey: 'ladder.level3' },
    { level: 4, minNetWorth: 3000 * WAN, i18nKey: 'ladder.level4' },
    { level: 5, minNetWorth: 3 * YI, i18nKey: 'ladder.level5' },
    { level: 6, minNetWorth: 30 * YI, i18nKey: 'ladder.level6' },
  ],

  highInterestRate: 0.08,

  // 見規格 4.5；台灣常用規則：無擔保負債不超過月收入 22 倍（DBR 22）、保費不超過年收入 10%（雙十原則）
  healthThresholds: {
    savings_rate: { better: 'higher', green: 0.1, yellow: 0, excellent: 0.2 },
    emergency_months: { better: 'higher', green: 3, yellow: 1, excellent: 6, tooHigh: 12 },
    debt_service_ratio: { better: 'lower', green: 0.3, yellow: 0.4 },
    housing_cost_ratio: { better: 'lower', green: 0.3, yellow: 0.4 },
    high_interest_debt: { better: 'lower', green: 0, yellow: 0 },
    unsecured_debt_multiple: { better: 'lower', green: 15, yellow: 22 },
    insurance_premium_ratio: { better: 'lower', green: 0.1, yellow: 0.2 },
  },

  // 見規格 5.6；名目年報酬，計算時一律換成扣除通膨的實質報酬
  defaultAssumptions: {
    inflation: 0.02,
    nominalReturn: { cash: 0.015, balanced: 0.05, growth: 0.065 },
    scenarioSpread: 0.02,
    safeWithdrawalRate: 0.04,
  },

  homeDefaults: { downPaymentRatio: 0.2, feesRatio: 0.03, mortgageTermMonths: 360 },

  // 見規格 4.7；範本只用股、債、現金、其他四大類比較，不涉及任何特定商品
  allocationPresets: [
    { id: 'conservative', i18nKey: 'portfolio.preset.conservative', allocation: { equity: 0.3, bond: 0.5, cash: 0.2, alternative: 0 } },
    { id: 'balanced', i18nKey: 'portfolio.preset.balanced', allocation: { equity: 0.6, bond: 0.3, cash: 0.1, alternative: 0 } },
    { id: 'aggressive', i18nKey: 'portfolio.preset.aggressive', allocation: { equity: 0.85, bond: 0.1, cash: 0.05, alternative: 0 } },
    { id: 'age_110', i18nKey: 'portfolio.preset.age_110', ageRule: { base: 110, cash: 0.05 } },
  ],
  concentrationLimit: 0.2,
  rebalanceBand: 0.05,

  // 行動建議（P4，見規格 4.9）。條件是宣告式資料，由 core/rules.ts 解析。
  // priority 越小越優先：先止血（高利債、透支），再建立安全網，再談投資與長期規劃。
  actionTemplates: [
    { id: 'pay_off_revolving', i18nKey: 'action.pay_off_revolving', category: 'debt', priority: 10, link: '/plans/new?type=debt_payoff' },
    { id: 'fix_deficit', i18nKey: 'action.fix_deficit', category: 'saving', priority: 15, link: '/cashflow' },
    { id: 'starter_emergency_fund', i18nKey: 'action.starter_emergency_fund', category: 'saving', priority: 20, link: '/plans/new?type=emergency_fund' },
    { id: 'pay_high_interest', i18nKey: 'action.pay_high_interest', category: 'debt', priority: 25, link: '/plans/new?type=debt_payoff' },
    { id: 'fill_unknown', i18nKey: 'action.fill_unknown', category: 'data_quality', priority: 30, link: '/' },
    { id: 'add_income', i18nKey: 'action.add_income', category: 'data_quality', priority: 32, link: '/cashflow' },
    { id: 'full_emergency_fund', i18nKey: 'action.full_emergency_fund', category: 'saving', priority: 40, link: '/plans/new?type=emergency_fund' },
    { id: 'reconcile_spending', i18nKey: 'action.reconcile_spending', category: 'data_quality', priority: 45, link: '/cashflow' },
    { id: 'raise_savings_rate', i18nKey: 'action.raise_savings_rate', category: 'saving', priority: 50, link: '/cashflow' },
    { id: 'grow_income', i18nKey: 'action.grow_income', category: 'income', priority: 55 },
    { id: 'learn_index_investing', i18nKey: 'action.learn_index_investing', category: 'investing', priority: 60, link: '/portfolio' },
    { id: 'set_retirement_goal', i18nKey: 'action.set_retirement_goal', category: 'investing', priority: 65, link: '/plans/new?type=retirement_fi' },
    { id: 'confirm_allocation', i18nKey: 'action.confirm_allocation', category: 'data_quality', priority: 68, link: '/portfolio' },
    { id: 'set_target_allocation', i18nKey: 'action.set_target_allocation', category: 'investing', priority: 70, link: '/portfolio' },
    { id: 'rebalance', i18nKey: 'action.rebalance', category: 'investing', priority: 72, link: '/portfolio' },
    { id: 'check_insurance', i18nKey: 'action.check_insurance', category: 'protection', priority: 75, link: '/cashflow' },
    { id: 'avoid_lifestyle_creep', i18nKey: 'action.avoid_lifestyle_creep', category: 'habit', priority: 80 },
    { id: 'update_stale', i18nKey: 'action.update_stale', category: 'data_quality', priority: 85, link: '/' },
    { id: 'protect_wealth', i18nKey: 'action.protect_wealth', category: 'protection', priority: 90 },
  ],
  actionRules: [
    {
      templateId: 'pay_off_revolving',
      when: { metric: 'debt.revolving_total', op: '>', value: 0 },
      params: { amount: { metric: 'debt.revolving_total' } },
    },
    { templateId: 'fix_deficit', when: { metric: 'cashflow.surplus', op: '<', value: 0 } },
    {
      templateId: 'starter_emergency_fund',
      when: { metric: 'health.emergency_months', op: '<', value: 1 },
      params: { target: { op: 'round', args: [{ metric: 'cashflow.monthly_outflow' }] } },
    },
    {
      templateId: 'pay_high_interest',
      when: { all: [{ metric: 'debt.high_interest_total', op: '>', value: 0 }, { metric: 'debt.revolving_total', op: '==', value: 0 }] },
      params: { amount: { metric: 'debt.high_interest_total' } },
    },
    { templateId: 'fill_unknown', when: { metric: 'precision.unresolved_count', op: '>', value: 0 } },
    { templateId: 'add_income', when: { missing: 'cashflow.income' } },
    {
      templateId: 'full_emergency_fund',
      when: { all: [{ metric: 'health.emergency_months', op: '>=', value: 1 }, { metric: 'health.emergency_months', op: '<', value: 3 }] },
      params: { target: { op: 'round', args: [{ op: '*', args: [{ metric: 'cashflow.monthly_outflow' }, { const: 3 }] }] } },
    },
    {
      templateId: 'reconcile_spending',
      when: { all: [{ metric: 'reconcile.done', op: '==', value: false }, { metric: 'cashflow.surplus', op: '>=', value: 0 }] },
    },
    {
      templateId: 'raise_savings_rate',
      when: { all: [{ metric: 'health.savings_rate', op: '>=', value: 0 }, { metric: 'health.savings_rate', op: '<', value: 0.1 }] },
    },
    // Maggiulli：L1～L2 的財富主要來自收入，提升收入比省小錢有效
    {
      templateId: 'grow_income',
      when: { all: [{ metric: 'ladder.level', op: '<=', value: 2 }, { metric: 'health.emergency_months', op: '>=', value: 1 }] },
    },
    {
      templateId: 'learn_index_investing',
      when: {
        all: [
          { metric: 'ladder.level', op: '>=', value: 2 },
          { metric: 'health.emergency_months', op: '>=', value: 3 },
          { metric: 'health.savings_rate', op: '>=', value: 0.1 },
          { metric: 'portfolio.invested', op: '==', value: 0 },
          { metric: 'debt.high_interest_total', op: '==', value: 0 },
        ],
      },
    },
    {
      templateId: 'set_retirement_goal',
      when: { all: [{ metric: 'health.emergency_months', op: '>=', value: 3 }, { metric: 'goal.retirement_fi.exists', op: '==', value: false }] },
    },
    { templateId: 'confirm_allocation', when: { metric: 'portfolio.guessed_count', op: '>', value: 0 } },
    {
      templateId: 'set_target_allocation',
      when: { all: [{ metric: 'portfolio.invested', op: '>', value: 0 }, { metric: 'portfolio.target_set', op: '==', value: false }] },
    },
    { templateId: 'rebalance', when: { metric: 'portfolio.needs_rebalance', op: '==', value: true } },
    {
      templateId: 'check_insurance',
      when: { all: [{ metric: 'expense.has_insurance', op: '==', value: false }, { metric: 'health.emergency_months', op: '>=', value: 1 }] },
    },
    { templateId: 'avoid_lifestyle_creep', when: { metric: 'ladder.level', op: '==', value: 3 } },
    { templateId: 'update_stale', when: { metric: 'precision.stale_count', op: '>', value: 0 } },
    { templateId: 'protect_wealth', when: { metric: 'ladder.level', op: '>=', value: 4 } },
  ],

  forgottenExpenses: [
    'forgotten.insurance',
    'forgotten.tax',
    'forgotten.red_envelope',
    'forgotten.travel',
    'forgotten.car_maintenance',
    'forgotten.gifts',
    'forgotten.medical',
    'forgotten.subscriptions',
  ],
};
