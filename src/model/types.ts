// 資料模型，對應 docs/02-data-model.md

/** ULID：可依時間排序，離線產生也不會衝突 */
export type ID = string;
/** ISO 8601 日期，例如 '2026-10-22' */
export type ISODate = string;
/** ISO 8601 時間戳記 */
export type ISODateTime = string;
/** ISO 4217，例如 'TWD'、'USD' */
export type CurrencyCode = string;
/** 地區代碼，例如 'TW' */
export type LocaleCode = string;

/** 估算值：本系統最核心的型別 */
export type Estimate =
  | {
      mode: 'unknown';
      /** 對應 LocalePack.statistics 的 key；沒有對應時該項目不納入計算 */
      statKey?: string;
    }
  | {
      mode: 'range';
      low: number;
      high: number;
      /** 從預設級距選取時記錄級距 id，以便 UI 還原選取狀態 */
      bracketId?: string;
    }
  | {
      mode: 'approx';
      value: number;
      /** 相對誤差，未填時取 Settings.defaultTolerance */
      tolerance?: number;
    }
  | {
      mode: 'exact';
      value: number;
      /** 數字是哪一天的（例如對帳單日期），用於過期判斷 */
      asOf: ISODate;
      source?: 'manual' | 'statement' | 'import';
    };

export type EstimateMode = Estimate['mode'];

/** 金額 = 估算值 + 幣別 */
export interface MoneyEstimate {
  estimate: Estimate;
  currency: CurrencyCode;
}

/** 解析後的區間（派生值，不儲存） */
export interface Range {
  low: number;
  mid: number;
  high: number;
}

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface BaseEntity {
  id: ID;
  householdId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** 軟刪除 */
  archivedAt?: ISODateTime;
}

export type OwnerRef = ID | 'joint';

export type HouseholdType = 'single' | 'couple' | 'couple_with_children' | 'single_parent' | 'other';

export interface Household {
  id: ID;
  name: string;
  localeCode: LocaleCode;
  baseCurrency: CurrencyCode;
  householdType: HouseholdType;
  region?: string;
  schemaVersion: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Member {
  id: ID;
  householdId: ID;
  displayName: string;
  birthYear?: Estimate;
  isPrimary: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type IncomeCategory =
  | 'salary'
  | 'bonus'
  | 'side_hustle'
  | 'business'
  | 'rental'
  | 'dividend_interest'
  | 'pension'
  | 'other';

export interface IncomeItem extends BaseEntity {
  ownerId: OwnerRef;
  category: IncomeCategory;
  label?: string;
  amount: MoneyEstimate;
  frequency: Frequency;
  isRecurring: boolean;
  basis: 'net' | 'gross';
}

export type ExpenseCategory =
  | 'housing'
  | 'utilities'
  | 'food'
  | 'transport'
  | 'telecom'
  | 'insurance'
  | 'children_education'
  | 'medical'
  | 'family_support'
  | 'leisure_travel'
  | 'shopping'
  | 'annual_irregular'
  | 'other'
  | (string & {});

export interface ExpenseItem extends BaseEntity {
  ownerId: OwnerRef;
  category: ExpenseCategory;
  label?: string;
  amount: MoneyEstimate;
  frequency: Frequency;
  essential: boolean;
}

export type AssetCategory =
  | 'cash'
  | 'investment'
  | 'crypto'
  | 'retirement'
  | 'insurance_cash_value'
  | 'real_estate'
  | 'vehicle'
  | 'receivable'
  | 'other';

export type Liquidity = 'liquid' | 'semi_liquid' | 'illiquid';

export type AssetClass =
  | 'cash'
  | 'equity_domestic'
  | 'equity_global'
  | 'bond'
  | 'real_estate'
  | 'crypto'
  | 'insurance'
  | 'other';

export interface Asset extends BaseEntity {
  ownerId: OwnerRef;
  category: AssetCategory;
  subtype?: string;
  label?: string;
  value: MoneyEstimate;
  liquidity: Liquidity;
  isPrimaryResidence?: boolean;
  allocation?: Partial<Record<AssetClass, number>>;
  note?: string;
}

export type LiabilityCategory =
  | 'mortgage'
  | 'car_loan'
  | 'personal_loan'
  | 'credit_card'
  | 'student_loan'
  | 'family_loan'
  | 'business_loan'
  | 'other';

export interface Liability extends BaseEntity {
  ownerId: OwnerRef;
  category: LiabilityCategory;
  label?: string;
  balance: MoneyEstimate;
  annualRate?: Estimate;
  monthlyPayment?: MoneyEstimate;
  remainingMonths?: Estimate;
  secured: boolean;
  securedByAssetId?: ID;
  isRevolving?: boolean;
  note?: string;
}

export interface FxRate {
  currency: CurrencyCode;
  rateToBase: number;
  asOf: ISODate;
}

export interface Settings {
  householdId: ID;
  language: string;
  defaultTolerance: number;
  staleAfterDays: number;
  fxRates: FxRate[];
  checkInFrequency: 'monthly' | 'quarterly' | 'off';
  nextCheckInDate?: ISODate;
  lastBackupAt?: ISODateTime;
  pinLockEnabled: boolean;
  onboardingCompletedAt?: ISODateTime;
  dismissedTips: string[];
  /** 對帳檢查：使用者估計過去一年存款（含投資）增加多少，用來比對收支估算 */
  reconciliation?: { lastYearSavingsChange: MoneyEstimate; answeredAt: ISODate };
}

/** 報酬率類型：短期目標用現金，長期目標用股債配置 */
export type ReturnProfile = 'cash' | 'balanced' | 'growth';

/** 使用者自訂的計算假設；未填的欄位使用地區資料包的預設值 */
export interface Assumptions {
  householdId: ID;
  inflation?: number;
  nominalReturn?: Partial<Record<ReturnProfile, number>>;
  /** 保守／樂觀情境 = 中性 ∓ spread（現金類只用四分之一） */
  scenarioSpread?: number;
  safeWithdrawalRate?: number;
}

export type GoalType =
  | 'emergency_fund'
  | 'debt_payoff'
  | 'home_down_payment'
  | 'retirement_fi'
  | 'education'
  | 'big_purchase'
  | 'custom';

export type GoalParams =
  | { kind: 'emergency_fund'; months: number }
  | { kind: 'retirement_fi'; withdrawalRate?: number }
  | { kind: 'home_down_payment'; homePrice: MoneyEstimate; downPaymentRatio: number; feesRatio: number }
  | { kind: 'debt_payoff'; liabilityIds: ID[]; strategy: 'avalanche' | 'snowball' };

export interface Goal extends BaseEntity {
  type: GoalType;
  /** 未填時顯示類型名稱 */
  name?: string;
  /** 以今天幣值表示；未填時由系統依類型自動計算（緊急預備金、財務自由、頭期款、還債） */
  target?: MoneyEstimate;
  targetDate?: ISODate;
  priority: number;
  /** 已撥給這個目標的資產；未填時依類型預設（緊急預備金 = 隨時可用資產，財務自由 = 投資類資產） */
  linkedAssets?: { assetId: ID; share: number }[];
  /** 每月投入；未填時用目前的每月結餘試算 */
  monthlyContribution?: MoneyEstimate;
  returnProfile?: ReturnProfile;
  params?: GoalParams;
  status: 'active' | 'achieved' | 'paused';
  achievedAt?: ISODate;
}

export interface SnapshotSummary {
  totalAssets: Range;
  totalLiabilities: Range;
  netWorth: Range;
  accessibleNetWorth: Range;
  monthlyIncome?: Range;
  monthlyExpense?: Range;
  precision: number;
  ladderLevel?: number;
  byAssetCategory: Partial<Record<AssetCategory, Range>>;
  byLiabilityCategory: Partial<Record<LiabilityCategory, Range>>;
}

export interface Snapshot extends BaseEntity {
  date: ISODate;
  trigger: 'manual' | 'check_in' | 'onboarding';
  baseCurrency: CurrencyCode;
  summary: SnapshotSummary;
  items: {
    assets: Pick<Asset, 'id' | 'category' | 'label' | 'value'>[];
    liabilities: Pick<Liability, 'id' | 'category' | 'label' | 'balance'>[];
  };
  fxRates: FxRate[];
  localePackVersion: string;
}
