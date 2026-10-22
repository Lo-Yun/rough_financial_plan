# 專案地圖

> 用途：之後要修改功能或回報問題時，用這份文件的**功能代號**和**檔案路徑**溝通，就能快速對到程式碼。
> 最後更新：2026-10-22（第三期完成、改名「順便理財」之後）
> 相關文件：[系統規格書](./01-system-spec.md)・[資料模型](./02-data-model.md)・[部署說明](./03-deploy-github-pages.md)・[開發歷程與路線圖](./05-roadmap.md)

---

## 1. 怎麼用這份地圖討論

回報問題或提出修改時，盡量包含：

1. **功能代號**（見第 3 節），例如「`F-CF` 收支頁」。
2. **畫面位置**：網址的 `#/` 後面那段，例如 `#/plans/new`。
3. **看到什麼 vs 預期什麼**，例如「儲蓄率顯示 -24% ～ 74%，預期範圍窄一點」。
4. 如果牽涉計算，附上當時輸入的數字（或匯出一份備份檔）。

範例：

> `F-HLT` 健檢頁的「保費負擔」，沒有填保費卻顯示 0% 綠燈。應該要顯示「無法計算」。

我收到後就能直接對到 `src/core/health.ts` 的 `computeHealth` 和 `src/features/health/HealthPage.tsx`。

---

## 2. 架構總覽

```
使用者操作
   │
   ▼
┌──────────────── 畫面層 src/features/、src/components/ ────────────────┐
│ 各功能頁面（React）。只負責顯示與收集輸入，不自己做財務計算。            │
└───────────────┬───────────────────────────────────▲────────────────────┘
                │ 寫入（repo.saveXxx）                │ 讀取（useApp()）
                ▼                                   │
┌──────── 資料層 src/data/ ────────┐   ┌──── 應用層 src/app/ ───────────────┐
│ Repo：所有讀寫都經過這裡          │──▶│ load.ts：從 IndexedDB 讀出全部資料   │
│ AppDB：IndexedDB（Dexie）結構     │   │ App.tsx：useLiveQuery 監看資料變化， │
│ backup.ts：匯出／匯入／加密       │   │   呼叫 computeOverview，放進 Context │
└──────────────────────────────────┘   └───────────────┬────────────────────┘
                                                       │ 呼叫
                                                       ▼
                         ┌──────── 計算核心 src/core/（純函式）────────┐
                         │ 估算值 → 區間 → 淨值／現金流／健檢／計畫／   │
                         │ 投資組合。不碰資料庫、不碰 React。           │
                         └───────────────▲─────────────────────────────┘
                                         │ 讀取規則與數值
                         ┌───────── 地區資料包 src/locales/tw/ ────────┐
                         │ pack.ts：分類、級距、統計值、門檻、預設利率、 │
                         │   配置範本⋯⋯（台灣專屬的數字都在這裡）        │
                         │ zh-TW.json：所有畫面文字                     │
                         └─────────────────────────────────────────────┘
```

**資料如何流動（以「修改一筆資產」為例）**

1. `ItemEditor` 呼叫 `repo.saveAsset()` 寫入 IndexedDB。
2. `App.tsx` 的 `useLiveQuery` 偵測到變化，重新執行 `loadFinancialData()`。
3. `computeOverview()` 重新計算淨值、精確度、現金流、還款、財富階梯。
4. 新的結果經由 `AppContext` 傳給所有頁面，畫面自動更新。

> 只有「快照」（淨值歷史）會把計算結果存下來，其他數字都是每次即時計算。

---

## 3. 功能代號表

| 代號 | 功能 | 網址 | 畫面檔案 | 主要計算 | 資料表 | 文字 key 前綴 |
|---|---|---|---|---|---|---|
| `F-ONB` | 快速估算引導 | （未完成引導時自動顯示） | `features/onboarding/Onboarding.tsx` | `computeOverview` | 全部 | `onboarding.*` |
| `F-NW` | 淨值總覽、資產負債列表 | `#/` | `features/balance-sheet/NetWorthPage.tsx` | `computeBalanceSheet`、`precisionScore`、`findNextRefinement` | assets、liabilities | `netWorth.*` |
| `F-ITEM` | 資產／負債編輯 | `#/asset/:id`、`#/liability/:id`（新增用 `new`） | `features/balance-sheet/ItemEditor.tsx` | `resolveDebt`（預覽每月還款） | assets、liabilities | `editor.*`、`allocation.*` |
| `F-LAD` | 財富階梯位置 | 淨值頁、引導結果頁 | `features/balance-sheet/LadderSummary.tsx` | `ladderPosition` | — | `ladder.*` |
| `F-HIST` | 淨值歷史曲線與快照 | `#/history` | `features/history/HistoryPage.tsx`（延遲載入） | `buildSnapshotData` | snapshots | `history.*`、`snapshot.*` |
| `F-CF` | 收支總覽、每月結餘 | `#/cashflow` | `features/cashflow/CashflowPage.tsx` | `monthlyIncome`、`monthlyExpense`、`overview.surplus` | incomeItems、expenseItems | `cashflow.*` |
| `F-FLOW` | 收入／支出編輯 | `#/income/:id`、`#/expense/:id` | `features/cashflow/FlowEditor.tsx` | — | incomeItems、expenseItems | `cashflow.*`、`frequency.*` |
| `F-REC` | 對帳檢查 | 收支頁下方 | `CashflowPage.tsx` 的 `ReconcileCard` | `reconcile` | settings.reconciliation | `reconcile.*`、`forgotten.*` |
| `F-HLT` | 財務健檢（7 燈號＋財務自由進度） | `#/health` | `features/health/HealthPage.tsx` | `computeHealth`、`lightFor` | — | `health.*` |
| `F-PLN` | 理財計畫列表 | `#/plans` | `features/plans/PlansPage.tsx` | `projectGoal` | goals | `plans.*` |
| `F-GOAL` | 計畫編輯與即時試算 | `#/plans/new?type=…`、`#/plans/:id` | `features/plans/GoalEditor.tsx`、`ProjectionView.tsx` | `projectGoal`、`simulatePayoff`、`amortizedPayment` | goals | `plans.*` |
| `F-PF` | 投資組合 | `#/portfolio` | `features/portfolio/PortfolioPage.tsx` | `analyzePortfolio`、`resolveTarget`、`deviations` | assets、holdings、assumptions | `portfolio.*` |
| `F-HOLD` | 持股明細 | `#/asset/:id/holdings`（編輯：`/new`、`/:holdingId`） | `features/portfolio/HoldingsPage.tsx`、`HoldingEditor.tsx` | `holdingValue`、`holdingsTotal`、`syncAssetFromHoldings` | holdings | `holdings.*` |
| `F-SET` | 設定（匯率、估算、試算假設、安裝、刪除） | `#/settings` | `features/settings/SettingsPage.tsx` | `resolveAssumptions` | settings、assumptions | `settings.*` |
| `F-BAK` | 備份匯出／還原 | 設定頁 | `SettingsPage.tsx` 的 `BackupSection` | — | 全部 | `backup.*` |
| `F-PWA` | 安裝、離線、持久化儲存 | — | `app/pwa.ts`、`vite.config.ts` | — | — | `pwa.*` |
| `F-EST` | 估算輸入元件（全 App 共用） | — | `components/EstimateInput.tsx`、`AmountField.tsx` | `convertEstimate`、`parseAmount` | — | `estimate.*`、`amount.*` |

下方分頁列（`App.tsx`）：淨值 `#/`・收支 `#/cashflow`・投資 `#/portfolio`・健檢 `#/health`・計畫 `#/plans`・設定 `#/settings`。

---

## 4. 計算核心 `src/core/`

全部是純函式，不依賴 React 或瀏覽器，每個檔案在 `tests/core/` 都有對應測試。

| 檔案 | 負責 | 主要函式 | 被誰使用 |
|---|---|---|---|
| `estimate.ts` | 估算值 → 區間；模式切換 | `resolveEstimate`、`convertEstimate`、`blankToUnknown`、`withStatKey` | 幾乎所有地方 |
| `interval.ts` | 區間算術（保守的最壞／最好組合） | `add`、`sub`、`sum`、`scale`、`div`、`point`、`ZERO` | 所有計算 |
| `currency.ts` | 金額估算 → 主要幣別區間（含匯率） | `resolveMoney` | balanceSheet、cashflow、debt、portfolio |
| `balanceSheet.ts` | 資產負債表、淨值、可動用淨值 | `computeBalanceSheet`、`isAccessibleAsset`、`isTiedToInaccessibleAsset` | overview |
| `cashflow.ts` | 收支換算成每月 | `toMonthly`、`monthlyIncome`、`monthlyExpense` | overview、health |
| `debt.ts` | 負債利率與每月還款、還債模擬 | `resolveDebt`、`resolveDebts`、`amortizedPayment`、`simulatePayoff` | overview、planning、ItemEditor |
| `precision.ts` | 依金額加權的精確度、過期判斷 | `precisionScore`、`isStale`、`estimateWeight` | overview、ModeBadge |
| `ladder.ts` | 財富階梯層級與進度 | `ladderPosition`、`levelFor` | overview |
| `overview.ts` | **總整理**：把以上全部算一次 | `computeOverview`、`moneyContext`、`findNextRefinement`、`buildSnapshotData` | App.tsx、actions.ts |
| `health.ts` | 財務健檢 7 個指標、最該處理的一件事、財務自由進度 | `computeHealth`、`lightFor`、`METRIC_PRIORITY` | HealthPage |
| `planning.ts` | 目標試算（實質報酬、三種情境）、買房與還債 | `projectGoal`、`resolveAssumptions`、`requiredMonthly`、`monthsToTarget`、`scenarioRates` | PlansPage、GoalEditor |
| `portfolio.ts` | 投資配置、目標、偏離、集中度、風險 | `analyzePortfolio`、`resolveTarget`、`deviations`、`holdingValue`、`holdingsTotal` | PortfolioPage、HoldingsPage、actions |
| `reconcile.ts` | 對帳檢查 | `reconcile` | CashflowPage |
| `format.ts` | 萬／億格式化、百分比、金額解析 | `formatCompact`、`formatRange`、`formatPercent`、`parseAmount` | context.tsx 的 `useFormat` |
| `date.ts` | 日期工具 | `todayISO`、`daysBetween` | 多處 |

**`Overview` 包含什麼**（`computeOverview` 的輸出，所有頁面都從這裡取數字）：
`balanceSheet`、`precision`、`ladder`、`income`、`recurringIncome`、`expense`、`essentialExpense`、`debts`、`debtPayments`、`surplus`、`nextRefinement`。

---

## 5. 資料層 `src/data/`

| 檔案 | 內容 |
|---|---|
| `db.ts` | IndexedDB 結構（Dexie），`SCHEMA_VERSION = 3` |
| `repo.ts` | `Repo` 類別：`saveXxx` / `archiveXxx` / `updateSettings` / `saveAssumptions` / `saveSnapshot` / `exportAll` / `importAll` / `deleteAll` |
| `backup.ts` | 匯出檔格式、AES-GCM 加密、`migratePayload` 舊版備份升級 |

**資料表與版本**

| 表 | 自哪一版 | 內容 |
|---|---|---|
| households、members、settings、assumptions、meta | v1 | 家庭、成員（出生年）、設定、試算假設、內部資訊 |
| incomeItems、expenseItems | v1 | 收入、支出 |
| assets、liabilities | v1 | 資產（含 allocation、valueFromHoldings）、負債（含利率、每月還款） |
| snapshots | v1 | 淨值快照（每天最多一筆） |
| goals | v2（第二期） | 理財目標 |
| holdings | v3（第三期） | 持股明細 |

**慣例**

- 刪除是「封存」（設定 `archivedAt`），計算時會過濾掉；只有「刪除所有資料」與「刪除快照」是真的刪除。
- 型別定義在 `src/model/types.ts`；地區資料包的型別在 `src/model/localePack.ts`。

---

## 6. 應用層 `src/app/`

| 檔案 | 內容 |
|---|---|
| `App.tsx` | 路由、分頁列、讀取資料、計算 Overview、決定顯示引導或主畫面 |
| `context.tsx` | `AppState`（`useApp()` 取得）、`useFormat()`、`usePlanningContext()`、`ageOf()` |
| `load.ts` | `loadFinancialData()`：一次讀出所有表 |
| `actions.ts` | 跨多表的動作：`recordSnapshot()`、`syncAssetFromHoldings()` |
| `pwa.ts` | 是否已安裝、iOS 判斷、持久化儲存、安裝提示 |

`useApp()` 可取得：`repo`、`pack`、`data`（household、settings、assets、liabilities、incomes、expenses）、`overview`、`snapshots`、`goals`、`holdings`、`assumptions`（已套預設值）、`storedAssumptions`、`primaryMember`、`today`。

---

## 7. 地區資料包 `src/locales/tw/pack.ts`

台灣專屬的數字都在這裡，改這些**不需要動計算程式**。

| 欄位 | 用途 | 使用者 |
|---|---|---|
| `categories` | 收入／支出／資產／負債分類；資產的預設流動性、預設配置、是否列入投資組合；負債的預設利率與期數 | 編輯頁、計算核心 |
| `brackets` | 「範圍」模式的級距按鈕 | `EstimateInput` |
| `statistics` | 選「不確定」時代入的統計值（**目前為概略值，待校對**） | `resolveEstimate` |
| `wealthLadder` | 財富階梯門檻（方案 A：30 萬／300 萬／3,000 萬／3 億／30 億） | `ladderPosition` |
| `highInterestRate` | 高利負債門檻（8%） | `resolveDebt` |
| `healthThresholds` | 7 個健檢指標的紅黃綠門檻 | `computeHealth` |
| `defaultAssumptions` | 通膨、報酬率、情境差距、安全提領率 | `resolveAssumptions` |
| `homeDefaults` | 自備款、雜費、房貸年限 | `projectGoal` |
| `forgottenExpenses` | 對帳時提醒的常忘支出 | `ReconcileCard` |
| `allocationPresets`、`concentrationLimit`、`rebalanceBand` | 投資組合範本、集中度 20%、再平衡 ±5 個百分點 | `portfolio.ts` |
| `numberUnits`、`inputUnitAliases` | 萬／億顯示與輸入 | `format.ts` |

文字在 `zh-TW.json`，依功能代號表的「文字 key 前綴」分區。

---

## 8. 測試與檢查

| 指令 | 內容 |
|---|---|
| `npm test` | 單元測試（Vitest），目前 98 個 |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run build` | 建置到 `dist/` |

| 測試檔 | 涵蓋 |
|---|---|
| `tests/core/*.test.ts` | 每個計算核心模組一個檔案 |
| `tests/data/repo.test.ts` | Repo 讀寫、快照、備份加密、v1→v2→v3 資料庫升級與備份遷移、持股同步 |
| `tests/i18n.test.ts` | 程式中用到的文字 key 都存在於 `zh-TW.json` |
| `tests/helpers.ts` | 測試用的資產、負債、設定工廠函式 |

**持續整合**：`.github/workflows/ci.yml` 在 PR 與 `main` 上跑型別檢查、測試、建置；`deploy.yml` 在 `main` 更新時部署到 GitHub Pages。

> 瀏覽器實測（Playwright）目前是開發時臨時執行的腳本，**尚未納入專案與 CI**（見路線圖的技術債）。

---

## 9. 除錯指南：症狀 → 先看哪裡

| 症狀 | 先看 |
|---|---|
| 某個數字算錯 | 找到功能代號 → 第 4 節對應的 `core/` 檔案；先寫一個重現的單元測試 |
| 範圍（區間）太寬或怪怪的 | `interval.ts`；比率是否把同一個不確定性算了兩次（見規格 5.2） |
| 選「不確定」後數字很奇怪 | `pack.ts` 的 `statistics` 與 `statKeys`（`model/localePack.ts`） |
| 外幣沒算進去 | `currency.ts`；設定頁是否填了匯率（淨值頁會顯示「缺少匯率」） |
| 每月還款或利率不對 | `debt.ts` 的 `resolveDebt`；`pack.ts` 負債類別的 `defaultAnnualRate`、`defaultTermMonths` |
| 健檢燈號不對 | `health.ts`；門檻在 `pack.ts` 的 `healthThresholds` |
| 計畫達成時間不對 | `planning.ts` 的 `projectGoal`；試算假設（設定頁）；報酬類型 `DEFAULT_RETURN_PROFILE` |
| 投資配置比例不對 | `portfolio.ts` 的 `analyzePortfolio`；優先順序：持股 → 自訂比例 → 預設 |
| 修改後畫面沒更新 | 寫入是否經過 `repo`；`load.ts` 是否有讀那張表；`App.tsx` 的 `useLiveQuery` |
| 畫面出現英文 key（例如 `netWorth.xxx`） | `zh-TW.json` 缺 key；跑 `npm test`，`i18n.test.ts` 會列出缺的 key |
| 舊使用者開啟後出錯 | `db.ts` 的版本定義；`tests/data/repo.test.ts` 的升級測試 |
| 還原備份失敗 | `backup.ts` 的 `inspectExport`、`migratePayload` |
| 部署後看不到新版 | Service Worker 快取：關掉再開或重新整理；`gh-pages` 分支是否有新的 Deploy commit |
| 瀏覽器主控台出現「Refused to …」 | 內容安全政策：`vite.config.ts` 的 `CSP` |
| 只有 iPhone 資料不見 | Safari 清除未安裝網站的資料（規格 6.4）；請使用者加入主畫面並定期備份 |

---

## 10. 常見修改的步驟清單

**新增一個畫面文字**
1. 在 `zh-TW.json` 對應前綴下新增 key。
2. 程式中用 `t('key')`。動態組合的 key（例如 `` t(`health.metric.${key}.name`) ``）要加到 `tests/i18n.test.ts` 的清單。

**新增或修改台灣的數值（門檻、利率、級距）**
1. 只改 `src/locales/tw/pack.ts`。
2. 跑 `npm test`，確認相關測試的預期值。

**新增資料欄位**
1. 改 `src/model/types.ts`（盡量用選填欄位，舊資料就不必轉換）。
2. 需要新的資料表或索引時：在 `db.ts` 新增 `this.version(N)`、`SCHEMA_VERSION` 加一；`repo.ts` 的 `ExportPayload`、`exportAll`、`importAll`、`allTables` 加上新表；`backup.ts` 的 `migratePayload` 補上舊版的預設值；在 `tests/data/repo.test.ts` 加升級測試。
3. 更新 `docs/02-data-model.md`。

**新增一個功能頁**
1. 計算放 `src/core/`（附測試），畫面放 `src/features/<名稱>/`。
2. 在 `App.tsx` 加路由（需要時加分頁）。
3. 在這份地圖的功能代號表加一列。
