import type {
  AssetCategory,
  CurrencyCode,
  ExpenseCategory,
  HouseholdType,
  IncomeCategory,
  LiabilityCategory,
  Liquidity,
  LocaleCode,
} from './types';

/** 地區資料包：隨 App 發布的唯讀資料，見 docs/02-data-model.md 第 4 節 */
export interface LocalePack {
  code: LocaleCode;
  version: string;
  baseCurrency: CurrencyCode;
  defaultLanguage: string;
  /** 常用的外幣，供輸入時快速選擇 */
  commonCurrencies: CurrencyCode[];
  /** 大數字單位，由大到小，例如 [億, 萬] */
  numberUnits: { value: number; i18nKey: string }[];
  /** 輸入金額時可用的單位寫法，例如 { '萬': 10000, 'k': 1000 } */
  inputUnitAliases: Record<string, number>;

  categories: {
    income: CategoryDef<IncomeCategory>[];
    expense: CategoryDef<ExpenseCategory>[];
    asset: (CategoryDef<AssetCategory> & { defaultLiquidity: Liquidity })[];
    liability: (CategoryDef<LiabilityCategory> & { defaultSecured: boolean })[];
  };

  /** 輸入級距，key 例如 'monthly_income' */
  brackets: Record<string, Bracket[]>;

  /** 「不知道」時代入的統計值 */
  statistics: Record<string, StatEntry>;

  /** 財富階梯，依序 L1→L6 的淨值下限（主要幣別） */
  wealthLadder: LadderLevelDef[];
}

export interface CategoryDef<K extends string = string> {
  key: K;
  i18nKey: string;
  icon?: string;
}

export interface Bracket {
  id: string;
  low: number;
  high: number;
}

export interface StatEntry {
  p25: number;
  p50: number;
  p75: number;
  source: string;
  year: number;
  /** 數值是否已對照原始資料校對 */
  verified: boolean;
}

export interface LadderLevelDef {
  level: number;
  minNetWorth: number;
  i18nKey: string;
}

export const statKeys = {
  monthlyExpenseTotal: (t: HouseholdType) => `expense.monthly_total.${t}`,
  monthlyIncomePerEarner: 'income.monthly_salary.per_earner',
} as const;
