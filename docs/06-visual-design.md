# 視覺設計規範

所有畫面與元件都要照這份規範做。改 UI 前先讀完；新增顏色、字級、圓角或圖示時，先改這份文件再改程式。

變數都定義在 `src/styles.css` 開頭的 `:root`，深色模式在 `@media (prefers-color-scheme: dark)` 裡對應同名變數。元件裡**不要直接寫色碼、px 字級或 px 圓角**，一律用下面的變數。

## 1. 品牌調性

墨綠＋米白，溫和、不焦慮，符合「差不多就好」的產品個性。畫面以白色卡片放在米白底上；顏色只用來傳達意思，不拿來裝飾。

## 2. 字級（6 級）

| 變數 | 尺寸 | 字重 | 用在 |
|---|---|---|---|
| `--fs-display` | 40px（2.5rem） | 700 | 主視覺大數字（淨值、投資總值） |
| `--fs-title` | 22px（1.375rem） | 700 | 頁標題（`h1`）、卡片內的重點數字（`.big`） |
| `--fs-heading` | 18px（1.125rem） | 700 | 卡片標題（`h2`）、導言（`.lead`） |
| `--fs-body` | 16px（1rem） | 400／600 | 內文、列表名稱、金額、小標（`h3`） |
| `--fs-secondary` | 14px（0.875rem） | 400 | 說明文字（`.small`）、按鈕、chip、表單標籤 |
| `--fs-caption` | 12px（0.75rem） | 400／600 | 標籤、徽章、分頁列文字、「約」字、欄位提示 |

- 不要新增其他字級；介於兩級之間時選較接近的一級。
- 最小字級是 12px，「約」字也不例外。
- 行高：內文 1.7，標題 1.3。
- 金額用 `font-variant-numeric: tabular-nums`，讓數字對齊。

## 3. 圓角（3 種＋全圓）

| 變數 | 尺寸 | 用在 |
|---|---|---|
| `--r-sm` | 8px | 輸入框、徽章、進度條、分段按鈕內的選項、色條 |
| `--r-md` | 12px | 按鈕、分段按鈕外框、卡片裡的內層卡（建議卡、預覽框） |
| `--r-lg` | 16px | 卡片（`.card`，也是 `--radius`） |
| `--r-full` | 999px | chip、圖示圓底、圖例色點 |

## 4. 色彩角色

每種顏色只做一件事。看到顏色，使用者就知道輕重。

| 角色 | 變數（字色／底色） | 只用於 | CSS 類別 |
|---|---|---|---|
| 品牌與行動 | `--accent` ／ `--accent-soft` | 主按鈕、已選取、連結、進度、「下一步」建議卡、圖示圓底 | `.btn.primary`、`.chip.active`、`.card.next-step`、`.ok` |
| 中性說明 | `--text` ／ `--neutral-soft` | 一般說明、教學提示、「預設值」標記 | `.card.tip` |
| 注意 | `--attention` ／ `--attention-soft` | 黃燈、到期提醒（每月回顧、備份）、偏離目標（再平衡、集中度）、估算過舊或未知 | `.card.attention`、`.warn` |
| 警示 | `--alert` ／ `--alert-soft` | 紅燈、高利負債、錯誤訊息、輸入錯誤、刪除 | `.alert`、`.btn.danger` |

其他規則：

- **示範模式**用中性深色橫幅（`--banner-bg`／`--banner-text`），不占用任何角色色。
- 健檢燈號沿用 `--red`／`--yellow`／`--green`，它們分別是警示、注意、品牌色的別名，不是另一組顏色。
- 黃色或紅色的卡片裡，主按鈕改成白底（見 `.top-issue`），不要在警示卡上放綠色主按鈕，兩個訊號會打架。
- 一般數字（例如目標配置 %）用一般文字色；只有偏離時才在旁邊加上「↑／↓」並用注意色。
- 投資配置圖的類別色（`--g-equity` 等）只用在配置圖與圖例。
- 文字和底色的對比至少 4.5:1（WCAG AA）。新增或調整顏色時，淺色與深色模式都要量。
- 不要再使用已移除的 `--warn`／`--warn-soft`（舊的橘色）。

## 5. 圖示

- 全 App 只用一套圖示：[Lucide](https://lucide.dev)（`lucide-react`），線寬 1.75、24px 網格，以 SVG 內嵌。
- 不要用 emoji 或 Unicode 符號（◎ ⇅ ✓ ✕ 等）當圖示。文字裡的 `›`、`→` 是標點，不算圖示。
- 一律透過 `src/components/Icon.tsx`：
  - `<Icon name="…" size={…} />`：單獨的圖示，例如分頁列（22px）、chip 內（16px）、勾選與刪除（16px）。
  - `<IconBadge name="…" />`：列表、計畫卡、健檢指標前的圖示，放在 36px 的 `--accent-soft` 圓底上，圖示是 `--accent` 色。
- 要新增圖示時，在 `Icon.tsx` 的 `ICONS` 加一個語意名稱（例如 `home`、`creditCard`），不要在元件裡直接 import Lucide。資料（例如 `LocalePack` 的類別）只存語意名稱。
- 圖示是裝飾，一律 `aria-hidden`，意思由旁邊的文字表達。只有圖示、沒有文字的按鈕要加 `aria-label`。

目前的對應：

| 位置 | 圖示 |
|---|---|
| 分頁列 | 淨值 `netWorth`、收支 `cashflow`、投資 `portfolio`、健檢 `health`、計畫 `plans`、設定 `settings` |
| 資產類別 | 現金 `cash`、投資 `investment`、加密資產 `crypto`、退休帳戶 `retirement`、儲蓄險 `insurance`、不動產 `home`、車 `car`、應收款 `receivable`、其他 `box` |
| 負債類別 | 房貸 `home`、車貸 `car`、信貸 `bank`、卡債 `creditCard`、學貸 `graduation`、親友借款 `family`、營業貸款 `store`、其他 `document` |
| 計畫類型 | 緊急預備金 `lifebuoy`、還清負債 `creditCard`、買房 `home`、財務自由 `sunrise`、子女教育金 `school`、大筆消費 `shopping`、自訂 `target` |
| 健檢指標 | 儲蓄率 `piggyBank`、緊急預備金 `lifebuoy`、還款負擔 `percent`、居住成本 `home`、高利負債 `creditCard`、無擔保負債 `scale`、保費負擔 `umbrella` |
| 動作 | 完成 `check`、刪除 `close` |

## 6. 品牌 logo

- logo 是像素風的鶺鴒（pixel wagtail），檔案在 `public/icons/`：`icon.svg`、`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（PWA）、`apple-touch-icon.png`、`favicon.svg`、`favicon-32.png`。
- **logo 只用在品牌位置**：App 圖示、favicon、歡迎頁。介面裡的圖示一律用 Lucide（第 5 節），不要把 logo 或像素風帶進 UI 圖示。
- 顯示 logo 時加 `image-rendering: pixelated`，避免放大後模糊。
- 品牌專用變數（只用在歡迎頁的 logo 與名稱）：`--fs-brand` 28px（品牌頁的「順便理財」）、`--r-brand-lg` 36px（160px 的 logo）、`--r-brand-md` 24px（112px 的 logo）、`--brand-shadow`。名稱字距 0.08em。
- 歡迎頁分兩頁：第 1 頁是品牌頁（logo、名稱、「OK，順便做吧！」按鈕，整組垂直置中），只在同一個分頁第一次打開時出現；第 2 頁是 112px logo＋名稱，下面接原本的說明卡與「開始估算」。

## 7. 間距

用 4px 的倍數：4、8、12、16、24、32。舊程式裡的 6、10、14、18px 之後改到附近的值。

## 8. 檢查清單（改 UI 時）

1. 只用本文件的字級、圓角、顏色變數與圖示。
2. 新顏色先判斷屬於哪個角色；不屬於任何角色就不要加。
3. 淺色、深色模式都截圖看過，320px 寬不能橫向捲動。
4. 新增的規則或例外寫回這份文件。
