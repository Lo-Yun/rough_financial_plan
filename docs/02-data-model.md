# 資料模型 v0.1（草案）

> 相關文件：[系統規格書](./01-system-spec.md)
> 型別以 TypeScript 表示，實作時放在 `src/model/`。

---

## 1. 總覽

```
Household (1) ──< Member
    │
    ├──< IncomeItem ───────┐
    ├──< ExpenseItem       │ ownerId → Member | 'joint'
    ├──< Asset ──< Holding │（P3）
    │       └─ allocation（各資產類別占比）
    ├──< Liability ─── securedByAssetId → Asset
    ├──< Goal ──── linkedAssetIds → Asset[]
    ├──< Snapshot          （歷史快照，P1）
    ├──< UserAction ─── templateId → ActionTemplate（地區資料包內）
    ├──< CheckIn
    └─── Settings / Assumptions

LocalePack（唯讀、隨 App 發布）：分類、級距、統計值、門檻、階梯、規則、行動範本
```

### 設計決策

1. **「資料」與「規則」分離**：使用者資料只存事實（估算值），所有門檻、統計值、規則都在 LocalePack。
2. **派生值不儲存**：淨值、指標、層級都即時計算。唯一的例外是 Snapshot，它是歷史紀錄，必須凍結。
3. **金額一律為「估算值 + 幣別」**：沒有任何金額欄位是純數字。
4. **分類使用穩定的英文 key**：顯示文字由 i18n 提供，讓不同地區可以增減分類。
5. **預留家庭成員**：所有收支和資產負債都有 `ownerId`，MVP 只有一位成員。

---

## 2. 共用型別

```ts
/** ULID：可依時間排序，離線產生也不會衝突 */
type ID = string;
/** ISO 8601 日期，例如 '2026-10-22' */
type ISODate = string;
/** ISO 8601 時間戳記 */
type ISODateTime = string;
/** ISO 4217，例如 'TWD'、'USD' */
type CurrencyCode = string;
/** 地區代碼，例如 'TW'；語言另由 Settings.language 決定 */
type LocaleCode = string;

/** 估算值：本系統最核心的型別 */
type Estimate =
  | {
      mode: 'unknown';
      /** 對應 LocalePack.statistics 的 key；沒有對應時該項目不納入計算 */
      statKey?: string;
    }
  | {
      mode: 'range';
      low: number;
      high: number;
      /** 如果是從預設級距選的，記錄級距 id，以便 UI 還原選取狀態 */
      bracketId?: string;
    }
  | {
      mode: 'approx';
      value: number;
      /** 相對誤差，預設取 Settings.defaultTolerance（0.15） */
      tolerance?: number;
    }
  | {
      mode: 'exact';
      value: number;
      /** 數字是哪一天的（例如對帳單日期），用於過期判斷 */
      asOf: ISODate;
      source?: 'manual' | 'statement' | 'import';
    };

type EstimateMode = Estimate['mode'];

/** 金額 = 估算值 + 幣別 */
interface MoneyEstimate {
  estimate: Estimate;
  currency: CurrencyCode;
}

/** 比率的估算值（例如利率 0.025），不帶幣別 */
type RateEstimate = Estimate;

/** 解析後的區間（派生值，不儲存） */
interface Range {
  low: number;
  mid: number;
  high: number;
}

type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** 所有使用者資料實體的共同欄位 */
interface BaseEntity {
  id: ID;
  householdId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** 軟刪除：快照仍可能參照，且保留未來同步的可能 */
  archivedAt?: ISODateTime;
}

type OwnerRef = ID | 'joint';
```

---

## 3. 實體

### 3.1 Household／Member

```ts
interface Household {
  id: ID;
  name: string;                 // 預設「我的財務」
  localeCode: LocaleCode;       // 'TW'
  baseCurrency: CurrencyCode;   // 'TWD'
  householdType: 'single' | 'couple' | 'couple_with_children' | 'single_parent' | 'other';
  region?: string;              // 縣市代碼，用來挑選統計預設值
  schemaVersion: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface Member {
  id: ID;
  householdId: ID;
  displayName: string;
  /** 出生年可以粗估，例如 1990±2 */
  birthYear?: Estimate;
  isPrimary: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

### 3.2 收入與支出

```ts
type IncomeCategory =
  | 'salary' | 'bonus' | 'side_hustle' | 'business' | 'rental'
  | 'dividend_interest' | 'pension' | 'other';

interface IncomeItem extends BaseEntity {
  ownerId: OwnerRef;
  category: IncomeCategory;
  label?: string;               // 使用者自訂名稱，例如「A 公司薪水」
  amount: MoneyEstimate;        // 每期金額
  frequency: Frequency;
  /** 經常性收入，才會用於緊急預備金與 DSR 計算 */
  isRecurring: boolean;
  /** 稅前或稅後；MVP 建議一律填稅後（實領） */
  basis: 'net' | 'gross';
}

/** 分類 key 由 LocalePack.expenseCategories 定義，此處為台灣預設 */
type ExpenseCategory =
  | 'housing' | 'utilities' | 'food' | 'transport' | 'telecom'
  | 'insurance' | 'children_education' | 'medical' | 'family_support'
  | 'leisure_travel' | 'shopping' | 'annual_irregular' | 'other'
  | (string & {});              // 允許地區資料包擴充

interface ExpenseItem extends BaseEntity {
  ownerId: OwnerRef;
  category: ExpenseCategory;
  label?: string;
  amount: MoneyEstimate;
  frequency: Frequency;
  /** 必要支出（緊急預備金用）或彈性支出 */
  essential: boolean;
}
```

> **規則**：貸款還款不建立 ExpenseItem，而是由 `Liability.monthlyPayment` 計入現金流。
> 「每月總花費一個數字」的粗估方式，用一筆 `category: 'other'`、`label: '總花費'` 的 ExpenseItem 表示；之後細分時，UI 引導使用者把這筆拆成多筆。

### 3.3 資產

```ts
type AssetCategory =
  | 'cash'               // 活存、定存、外幣存款
  | 'investment'         // 證券帳戶：股票、ETF、基金、債券
  | 'crypto'
  | 'retirement'         // 勞退個人專戶、自提、海外退休帳戶
  | 'insurance_cash_value' // 儲蓄險、投資型保單的解約金
  | 'real_estate'
  | 'vehicle'
  | 'receivable'         // 借給別人的錢、押金
  | 'other';

type Liquidity = 'liquid' | 'semi_liquid' | 'illiquid';
// liquid：立即可用（活存、貨幣基金）
// semi_liquid：數日到數週可變現（股票、定存解約）
// illiquid：難以變現或有懲罰（房產、退休帳戶、儲蓄險）

type AssetClass =
  | 'cash' | 'equity_domestic' | 'equity_global' | 'bond'
  | 'real_estate' | 'crypto' | 'insurance' | 'other';

interface Asset extends BaseEntity {
  ownerId: OwnerRef;
  category: AssetCategory;
  /** 子類別，由 LocalePack 定義，例如 'primary_residence'、'time_deposit' */
  subtype?: string;
  label?: string;
  value: MoneyEstimate;
  /** 預設依 category 帶入 LocalePack 的設定，使用者可以覆寫 */
  liquidity: Liquidity;
  /** 自住房，用於「可動用淨值」與居住成本計算 */
  isPrimaryResidence?: boolean;
  /** 投資組合用（P3）：各資產類別比例，總和為 1；未填時依 category 推定 */
  allocation?: Partial<Record<AssetClass, number>>;
  /** 指定給哪些目標（也可以在 Goal 端指定，以 Goal 為準） */
  note?: string;
}

/** P3：選用的持股明細，存在時 Asset.value 可由持股自動加總 */
interface Holding extends BaseEntity {
  assetId: ID;
  symbol?: string;              // '0050'、'VT'
  name: string;
  assetClass: AssetClass;
  quantity?: number;
  costBasis?: MoneyEstimate;
  /** 手動輸入的現價（初期沒有報價 API） */
  price?: { value: number; currency: CurrencyCode; asOf: ISODate };
  /** 沒有數量或價格時，直接粗估市值 */
  marketValue?: MoneyEstimate;
}
```

### 3.4 負債

```ts
type LiabilityCategory =
  | 'mortgage' | 'car_loan' | 'personal_loan' | 'credit_card'
  | 'student_loan' | 'family_loan' | 'business_loan' | 'other';

interface Liability extends BaseEntity {
  ownerId: OwnerRef;
  category: LiabilityCategory;
  label?: string;
  balance: MoneyEstimate;           // 剩餘本金
  annualRate?: RateEstimate;        // 未填時用 LocalePack 的預設利率
  monthlyPayment?: MoneyEstimate;   // 未填時依餘額、利率、期數推算
  remainingMonths?: Estimate;
  /** 有擔保（房貸、車貸）或無擔保，用於 DBR 22 倍計算；預設依 category 推定 */
  secured: boolean;
  securedByAssetId?: ID;
  /** 信用卡：本期全額繳清就不算高利負債 */
  isRevolving?: boolean;
}
```

### 3.5 目標

```ts
type GoalType =
  | 'emergency_fund' | 'debt_payoff' | 'home_down_payment'
  | 'retirement_fi' | 'education' | 'big_purchase' | 'custom';

interface Goal extends BaseEntity {
  type: GoalType;
  name: string;
  /** 以「今天幣值」表示的目標金額；部分類型可由系統自動計算（見下） */
  target: MoneyEstimate | { auto: true };
  targetDate?: ISODate;
  priority: number;                 // 1 = 最優先
  /** 已經撥給這個目標的資產（全部或部分） */
  linkedAssets?: { assetId: ID; share: number }[];  // share 0–1
  /** 使用者承諾的每月投入金額（選填），未填時用系統建議值 */
  monthlyContribution?: MoneyEstimate;
  /** 目標特有參數 */
  params?:
    | { kind: 'emergency_fund'; months: number }                       // 預設 6
    | { kind: 'retirement_fi'; withdrawalRate?: number; retireAge?: number }
    | { kind: 'home_down_payment'; homePrice: MoneyEstimate; downPaymentRatio: number; feesRatio: number }
    | { kind: 'debt_payoff'; liabilityIds: ID[]; strategy: 'avalanche' | 'snowball' };
  status: 'active' | 'achieved' | 'paused';
  achievedAt?: ISODate;
}
```

`target: { auto: true }` 的計算方式：

- 緊急預備金 = (必要支出 + 月還款) × months
- 財務自由 = 年支出 ÷ 安全提領率
- 頭期款 = 房價 × (自備比例 + 雜費比例)
- 還債 = 指定負債的餘額總和

### 3.6 設定與假設

```ts
interface Settings {
  householdId: ID;                  // 一個家庭一筆
  language: string;                 // 'zh-TW'
  defaultTolerance: number;         // 0.15
  staleAfterDays: number;           // 180，精確值超過此天數就降權
  fxRates: { currency: CurrencyCode; rateToBase: number; asOf: ISODate }[];
  checkInFrequency: 'monthly' | 'quarterly' | 'off';
  nextCheckInDate?: ISODate;
  lastBackupAt?: ISODateTime;
  pinLockEnabled: boolean;
  onboardingCompletedAt?: ISODateTime;
  /** 已關閉的提示 id，避免重複打擾 */
  dismissedTips: string[];
}

interface Assumptions {
  householdId: ID;
  /** 未填的欄位使用 LocalePack.defaultAssumptions */
  inflation?: number;
  nominalReturn?: Partial<Record<AssetClass, number>>;
  scenarioSpread?: number;          // 保守／樂觀 = 中性 ∓ spread，預設 0.02
  salaryGrowth?: number;
  safeWithdrawalRate?: number;
  targetAllocation?: Partial<Record<AssetClass, number>> | { preset: string };
}
```

### 3.7 快照（歷史）

```ts
interface Snapshot extends BaseEntity {
  date: ISODate;                    // 一天最多一筆（householdId + date 唯一）
  trigger: 'manual' | 'check_in' | 'onboarding';
  baseCurrency: CurrencyCode;
  /** 凍結的計算結果，用來畫曲線；之後即使規則改版，歷史也不會變 */
  summary: {
    totalAssets: Range;
    totalLiabilities: Range;
    netWorth: Range;
    accessibleNetWorth: Range;
    monthlyIncome?: Range;
    monthlyExpense?: Range;
    precision: number;              // 0–1
    ladderLevel?: number;           // 1–6，依 netWorth.mid
    byAssetCategory: Partial<Record<AssetCategory, Range>>;
    byLiabilityCategory: Partial<Record<LiabilityCategory, Range>>;
  };
  /** 當時各項目的估算值副本，用來重算或比較差異；資料量小，直接保存 */
  items: {
    assets: Pick<Asset, 'id' | 'category' | 'label' | 'value'>[];
    liabilities: Pick<Liability, 'id' | 'category' | 'label' | 'balance'>[];
  };
  fxRates: Settings['fxRates'];
  localePackVersion: string;
}
```

### 3.8 行動與回顧（P4）

```ts
interface UserAction extends BaseEntity {
  /** 系統建議時為範本 id；使用者自訂時不填 */
  templateId?: string;
  title?: string;                   // 自訂行動用；範本行動的文字由 i18n 提供
  /** 範本參數，例如 { amount: 5000 }，用於文字插值 */
  params?: Record<string, number | string>;
  status: 'suggested' | 'active' | 'done' | 'dismissed';
  dismissReason?: 'not_relevant' | 'later' | 'already_done' | 'other';
  priority: number;
  dueDate?: ISODate;
  acceptedAt?: ISODateTime;
  completedAt?: ISODateTime;
  /** 產生建議時的觸發條件快照，用來解釋「為什麼建議這個」 */
  triggerContext?: Record<string, number | string | boolean>;
  relatedGoalId?: ID;
}

interface CheckIn extends BaseEntity {
  date: ISODate;
  hadMajorChange: boolean;
  updatedItemIds: ID[];
  completedActionIds: ID[];
  snapshotId: ID;
  mood?: 1 | 2 | 3 | 4 | 5;         // 選填：對財務狀況的感受
  note?: string;
}
```

---

## 4. 地區資料包（LocalePack）

隨 App 發布的唯讀資料，不存在 IndexedDB。新增國家時，只要新增一份資料包。
P1 已實作的欄位見 `src/model/localePack.ts`；`healthThresholds`、`defaultAssumptions`、`allocationPresets`、`actionTemplates`、`rules` 於 P2 以後加入。

```ts
interface LocalePack {
  code: LocaleCode;                 // 'TW'
  version: string;                  // '2026.10.0'，快照會記錄
  baseCurrency: CurrencyCode;
  defaultLanguage: string;
  commonCurrencies: CurrencyCode[];                                // 輸入時可選的幣別
  numberUnits: { value: number; i18nKey: string }[];               // 顯示單位，由大到小：億、萬
  inputUnitAliases: Record<string, number>;                        // 輸入單位：'萬' → 10000、'k' → 1000

  categories: {
    income: CategoryDef[];
    expense: CategoryDef[];
    asset: (CategoryDef & { defaultLiquidity: Liquidity; defaultAllocation?: Partial<Record<AssetClass, number>>; subtypes?: CategoryDef[] })[];
    liability: (CategoryDef & { defaultSecured: boolean; defaultAnnualRate: number })[];
  };

  /** 輸入級距，例如月收入、月支出、存款 */
  brackets: Record<string, { id: string; low: number; high: number }[]>;

  /** 「不知道」時代入的統計值；key 例如 'expense.monthly_total.couple' */
  statistics: Record<string, { p25: number; p50: number; p75: number; source: string; year: number; verified: boolean }>;

  /** 健檢指標的門檻 */
  healthThresholds: Record<HealthMetricKey, { red?: [number, number]; yellow?: [number, number]; green?: [number, number]; higherIsBetter: boolean }>;

  /** 財富階梯門檻（主要幣別），依序 L1→L6 的下限 */
  wealthLadder: { level: number; minNetWorth: number; i18nKey: string }[];

  defaultAssumptions: Required<Omit<Assumptions, 'householdId' | 'targetAllocation'>>;
  allocationPresets: { id: string; i18nKey: string; allocation: Partial<Record<AssetClass, number>> | { rule: 'age_based'; base: number } }[];

  actionTemplates: ActionTemplate[];
  rules: ActionRule[];
}

interface CategoryDef { key: string; i18nKey: string; icon?: string }

type HealthMetricKey =
  | 'savings_rate' | 'emergency_months' | 'debt_service_ratio' | 'housing_cost_ratio'
  | 'high_interest_debt' | 'unsecured_debt_multiple' | 'insurance_premium_ratio' | 'fi_progress';

interface ActionTemplate {
  id: string;                       // 'tw.pay_off_credit_card'
  i18nKey: string;
  learnMoreUrl?: string;
  category: 'debt' | 'saving' | 'income' | 'investing' | 'protection' | 'data_quality' | 'habit';
  defaultPriority: number;
}

/** 規則：條件成立時建議某個行動範本 */
interface ActionRule {
  id: string;
  templateId: string;
  /** 宣告式條件，由 core/rules.ts 解析；避免在資料包內放可執行程式碼 */
  when: Condition;
  /** 計算範本參數，例如建議每月存款金額 */
  params?: Record<string, Expression>;
}

type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { metric: string; op: '<' | '<=' | '>' | '>=' | '==' | '!='; value: number | string | boolean };

type Expression = { metric: string } | { const: number } | { op: '+' | '-' | '*' | '/' | 'max' | 'min'; args: Expression[] };
```

條件中可以使用的 `metric` 由計算核心提供，例如 `health.emergency_months`、`ladder.level`、`precision.overall`、`liability.credit_card_revolving.total`、`goal.emergency_fund.exists`。

---

## 5. IndexedDB 結構（Dexie）

```ts
// P1 已建立的表見 src/data/db.ts；holdings、goals、userActions、checkIns 於後續版本加入
db.version(1).stores({
  households:   'id',
  members:      'id, householdId',
  incomeItems:  'id, householdId, category, archivedAt',
  expenseItems: 'id, householdId, category, archivedAt',
  assets:       'id, householdId, category, archivedAt',
  holdings:     'id, householdId, assetId',
  liabilities:  'id, householdId, category, archivedAt',
  goals:        'id, householdId, status, priority',
  snapshots:    'id, householdId, &[householdId+date], date',
  userActions:  'id, householdId, status, templateId',
  checkIns:     'id, householdId, date',
  settings:     'householdId',
  assumptions:  'householdId',
  meta:         'key',          // schemaVersion、上次遷移時間等
});
```

- 所有寫入都經過 repository 層，由它負責自動更新 `updatedAt`。
- Schema 變更時，在 `src/data/migrations/` 新增 `vN.ts`，由 Dexie 的 `upgrade()` 執行。匯入舊版備份時，套用同一套遷移函式。

---

## 6. 派生計算（不儲存）

| 函式（`src/core/`） | 輸入 | 輸出 |
|---|---|---|
| `resolveEstimate(e, ctx)` | Estimate、LocalePack 統計值、Settings | `Range \| null` |
| `toBaseCurrency(m, fx)` | MoneyEstimate、匯率 | Range（主要幣別） |
| `monthlyCashflow(data)` | 收入、支出、負債 | 月收入、月支出、月還款、月結餘（皆為 Range） |
| `balanceSheet(data)` | 資產、負債 | 分類小計、淨值、可動用淨值 |
| `precisionScore(items)` | 所有估算值 | 整體與各區精確度、未知項目數 |
| `healthReport(data, pack)` | 現金流、資產負債表 | 各指標的 Range 與燈號 |
| `projectGoal(goal, data, assumptions)` | 目標 | 每月需存金額、達成日期區間（三種情境） |
| `portfolio(data, pack)` | 投資類資產、持股 | 實際配置、偏離、集中度 |
| `ladderPosition(netWorth, pack)` | 淨值 Range | 層級、跨層標記、對數進度、預估升級年數 |
| `evaluateRules(metrics, pack, actions)` | 指標、既有行動 | 新的建議行動（去重） |

---

## 7. 匯出格式

```ts
interface ExportFile {
  format: 'rough-financial-plan-export';
  schemaVersion: number;
  exportedAt: ISODateTime;
  appVersion: string;
  encrypted: boolean;
  /** encrypted = true 時，payload 為 base64(AES-GCM 密文)，並附上 salt、iv、PBKDF2 迭代次數 */
  crypto?: { salt: string; iv: string; iterations: number };
  payload: ExportPayload | string;
}

interface ExportPayload {
  household: Household;
  members: Member[];
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  assets: Asset[];
  holdings: Holding[];
  liabilities: Liability[];
  goals: Goal[];
  snapshots: Snapshot[];
  userActions: UserAction[];
  checkIns: CheckIn[];
  settings: Settings;
  assumptions: Assumptions;
}
```

---

## 8. 範例資料

快速估算完成後，一位單身上班族的資料可能長這樣（節錄）：

```json
{
  "incomeItems": [
    { "category": "salary", "amount": { "estimate": { "mode": "range", "low": 50000, "high": 80000, "bracketId": "inc_50_80k" }, "currency": "TWD" },
      "frequency": "monthly", "isRecurring": true, "basis": "net" },
    { "category": "bonus", "amount": { "estimate": { "mode": "approx", "value": 130000 }, "currency": "TWD" },
      "frequency": "yearly", "isRecurring": false, "basis": "net" }
  ],
  "expenseItems": [
    { "category": "other", "label": "總花費", "amount": { "estimate": { "mode": "unknown", "statKey": "expense.monthly_total.single" }, "currency": "TWD" },
      "frequency": "monthly", "essential": true }
  ],
  "assets": [
    { "category": "cash", "value": { "estimate": { "mode": "exact", "value": 312450, "asOf": "2026-10-20" }, "currency": "TWD" }, "liquidity": "liquid" },
    { "category": "cash", "label": "美元定存", "value": { "estimate": { "mode": "approx", "value": 5000 }, "currency": "USD" }, "liquidity": "semi_liquid" },
    { "category": "investment", "value": { "estimate": { "mode": "approx", "value": 400000 }, "currency": "TWD" }, "liquidity": "semi_liquid",
      "allocation": { "equity_domestic": 0.7, "bond": 0.3 } }
  ],
  "liabilities": [
    { "category": "student_loan", "balance": { "estimate": { "mode": "range", "low": 100000, "high": 200000 }, "currency": "TWD" }, "secured": false }
  ]
}
```
