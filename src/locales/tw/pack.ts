import type { Bracket, LocalePack } from '../../model/localePack';

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

// 主計總處家庭收支調查、受僱員工薪資調查的概略值。
// verified: false 表示尚未對照原始資料校對，上線前必須更新。
const STAT_SOURCE = '行政院主計總處 家庭收支調查（概略值，待校對）';

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
      { key: 'cash', i18nKey: 'category.asset.cash', icon: '💵', defaultLiquidity: 'liquid', defaultAllocation: { cash: 1 }, inPortfolio: false },
      { key: 'investment', i18nKey: 'category.asset.investment', icon: '📈', defaultLiquidity: 'semi_liquid', defaultAllocation: { equity_domestic: 1 }, inPortfolio: true },
      { key: 'crypto', i18nKey: 'category.asset.crypto', icon: '🪙', defaultLiquidity: 'semi_liquid', defaultAllocation: { crypto: 1 }, inPortfolio: true },
      { key: 'retirement', i18nKey: 'category.asset.retirement', icon: '🧓', defaultLiquidity: 'illiquid', defaultAllocation: { other: 1 }, inPortfolio: true },
      { key: 'insurance_cash_value', i18nKey: 'category.asset.insurance_cash_value', icon: '🛡️', defaultLiquidity: 'illiquid', defaultAllocation: { insurance: 1 }, inPortfolio: true },
      { key: 'real_estate', i18nKey: 'category.asset.real_estate', icon: '🏠', defaultLiquidity: 'illiquid', defaultAllocation: { real_estate: 1 }, inPortfolio: false },
      { key: 'vehicle', i18nKey: 'category.asset.vehicle', icon: '🚗', defaultLiquidity: 'illiquid', defaultAllocation: { other: 1 }, inPortfolio: false },
      { key: 'receivable', i18nKey: 'category.asset.receivable', icon: '🤝', defaultLiquidity: 'semi_liquid', defaultAllocation: { other: 1 }, inPortfolio: false },
      { key: 'other', i18nKey: 'category.asset.other', icon: '📦', defaultLiquidity: 'semi_liquid', defaultAllocation: { other: 1 }, inPortfolio: false },
    ],
    liability: [
      { key: 'mortgage', i18nKey: 'category.liability.mortgage', icon: '🏠', defaultSecured: true, defaultAnnualRate: 0.022, defaultTermMonths: 240 },
      { key: 'car_loan', i18nKey: 'category.liability.car_loan', icon: '🚗', defaultSecured: true, defaultAnnualRate: 0.04, defaultTermMonths: 60 },
      { key: 'personal_loan', i18nKey: 'category.liability.personal_loan', icon: '🏦', defaultSecured: false, defaultAnnualRate: 0.06, defaultTermMonths: 84 },
      { key: 'credit_card', i18nKey: 'category.liability.credit_card', icon: '💳', defaultSecured: false, defaultAnnualRate: 0.15, defaultTermMonths: 24 },
      { key: 'student_loan', i18nKey: 'category.liability.student_loan', icon: '🎓', defaultSecured: false, defaultAnnualRate: 0.018, defaultTermMonths: 96 },
      { key: 'family_loan', i18nKey: 'category.liability.family_loan', icon: '👪', defaultSecured: false, defaultAnnualRate: 0, defaultTermMonths: 60 },
      { key: 'business_loan', i18nKey: 'category.liability.business_loan', icon: '🏪', defaultSecured: false, defaultAnnualRate: 0.04, defaultTermMonths: 84 },
      { key: 'other', i18nKey: 'category.liability.other', icon: '📄', defaultSecured: false, defaultAnnualRate: 0.05, defaultTermMonths: 60 },
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
    'expense.monthly_total.single': { p25: 18_000, p50: 25_000, p75: 35_000, source: STAT_SOURCE, year: 2024, verified: false },
    'expense.monthly_total.couple': { p25: 35_000, p50: 50_000, p75: 65_000, source: STAT_SOURCE, year: 2024, verified: false },
    'expense.monthly_total.couple_with_children': { p25: 55_000, p50: 75_000, p75: 95_000, source: STAT_SOURCE, year: 2024, verified: false },
    'expense.monthly_total.single_parent': { p25: 32_000, p50: 45_000, p75: 60_000, source: STAT_SOURCE, year: 2024, verified: false },
    'expense.monthly_total.other': { p25: 40_000, p50: 55_000, p75: 75_000, source: STAT_SOURCE, year: 2024, verified: false },
    'income.monthly_salary.per_earner': {
      p25: 33_000,
      p50: 43_000,
      p75: 60_000,
      source: '行政院主計總處 受僱員工薪資調查（概略值，待校對）',
      year: 2024,
      verified: false,
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
