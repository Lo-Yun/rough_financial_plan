# 順便理財：給 agent 的說明

## 必讀文件

開始任何工作前先讀：

- `docs/04-project-map.md`：功能、檔案與文案 key 的對照。
- `docs/05-roadmap.md`：開發歷程、決策紀錄、已知限制。合併 PR 後在「開發歷程」加一列。
- `docs/06-visual-design.md`：**視覺設計規範**。任何 UI 或樣式的改動都必須照這份文件：字級、圓角、色彩角色、圖示（Lucide，透過 `src/components/Icon.tsx`）。新增規則或例外時先更新這份文件。

規格與資料模型在 `docs/01-system-spec.md`、`docs/02-data-model.md`。

## 開發

- `npm run typecheck`、`npm test`（單元測試）、`npm run build` 後 `npm run test:e2e`（瀏覽器測試）。
- 介面文字都在 `src/locales/tw/zh-TW.json`，使用者以繁體中文溝通。
