# 順便理財（Rough Financial Plan）

用「大概的數字」就能看懂自己的財務狀況：簡單的財務分析、理財計畫、投資組合儀表板與資產負債淨值表，再一步步把數字變精確，並以財富階梯（Maggiulli《The Wealth Ladder》）引導行動。

- 網址：<https://lo-yun.github.io/rough_financial_plan/>
- 形式：PWA，資料只存在本機（IndexedDB），不需要註冊，也不收集任何使用統計
- 市場：先做台灣，台灣專屬規則集中在地區資料包（`src/locales/tw/`），保留國際化彈性

## 文件

- [系統規格書](docs/01-system-spec.md)
- [資料模型](docs/02-data-model.md)
- [部署到 GitHub Pages](docs/03-deploy-github-pages.md)
- [專案地圖](docs/04-project-map.md)：功能代號、檔案位置、除錯指南
- [開發歷程與路線圖](docs/05-roadmap.md)：做過什麼、決策紀錄、技術債、未來方向

## 開發

需要 Node.js 22。

```bash
npm install
npm run dev        # 開發伺服器
npm test           # 單元測試（計算核心、資料層、翻譯完整性）
npm run typecheck
npm run build      # 產生 dist/（合併到 main 後自動部署，見 docs/03-deploy-github-pages.md）
npm run test:e2e   # 瀏覽器端對端測試（需先 build）
```

## 目錄

```
src/
  core/         純計算（不依賴 React 或瀏覽器）：估算值、區間、淨值、收支、健檢、計畫、投資組合、行動規則、回顧
  model/        型別定義
  data/         IndexedDB（Dexie）、repository、備份匯出入與加密
  locales/tw/   台灣地區資料包與繁體中文文字
  components/   共用元件：估算輸入、金額輸入、區間顯示、精確度環
  features/     各功能頁（快速估算、淨值、收支、健檢、計畫、投資、行動、財富階梯、回顧、設定⋯⋯）
  app/          App 殼、路由、PWA 輔助
tests/          core/、data/ 單元測試；e2e/ 瀏覽器測試
docs/           規格、資料模型、部署、專案地圖、路線圖
```

## 進度

- [x] **P1 基礎**：快速估算引導、估算輸入元件、資產負債表與淨值、可動用淨值、精確度、下一步建議、淨值快照與歷史曲線、財富階梯位置、備份匯出入（可加密）、PWA
- [x] **P2 分析與計畫**：收支編輯與對帳檢查、負債利率與每月還款、財務健檢（7 項燈號＋財務自由進度）、理財目標試算（緊急預備金、還債雪崩／雪球比較、買房頭期款與房貸負擔、財務自由、自訂目標）、試算假設設定
- [x] **P3 投資組合**：資產類別配置（單一或混合比例）、持股明細（股數 × 現價或估市值，可自動更新帳戶價值）、目前 vs 目標配置（四種範本＋自訂）、再平衡提示、集中度警示、風險等級、幣別分布
- [x] **P4 財富階梯行動與追蹤**：行動建議引擎（19 個範本）、行動清單（接受／略過／完成／自訂，最多 3 項進行中）、財富階梯完整頁（到下一層的時間、0.01% 法則）、每月回顧（約 1 分鐘）

## 授權

- 本專案保留所有權利，原始碼公開僅供閱覽，詳見 [LICENSE](LICENSE)。
- 「順便理財」名稱與白鶺鴒標誌是品牌素材，不屬於任何程式碼授權，使用規範見
  [TRADEMARKS.md](TRADEMARKS.md)。
