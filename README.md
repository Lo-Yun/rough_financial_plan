# 隨便理財（Rough Financial Plan）

用「大概的數字」就能看懂自己的財務狀況：簡單的財務分析、理財計畫、投資組合儀表板與資產負債淨值表，再一步步把數字變精確，並以財富階梯（Maggiulli《The Wealth Ladder》）引導行動。

- 形式：PWA，資料只存在本機（IndexedDB），不需要註冊，也不收集任何使用統計
- 市場：先做台灣，台灣專屬規則集中在地區資料包（`src/locales/tw/`），保留國際化彈性

## 文件

- [系統規格書](docs/01-system-spec.md)
- [資料模型](docs/02-data-model.md)
- [部署到 Cloudflare Pages](docs/03-deploy-cloudflare.md)

## 開發

需要 Node.js 22。

```bash
npm install
npm run dev        # 開發伺服器
npm test           # 單元測試（計算核心、資料層、翻譯完整性）
npm run typecheck
npm run build      # 產生 dist/（部署方式見 docs/03-deploy-cloudflare.md）
```

## 目錄

```
src/
  core/         純計算（不依賴 React 或瀏覽器）：估算值、區間運算、淨值、精確度、財富階梯、格式化
  model/        型別定義
  data/         IndexedDB（Dexie）、repository、備份匯出入與加密
  locales/tw/   台灣地區資料包與繁體中文文字
  components/   共用元件：估算輸入、金額輸入、區間顯示、精確度環
  features/     onboarding、balance-sheet、history、settings
  app/          App 殼、路由、PWA 輔助
tests/
docs/
```

## 進度

- [x] **P1 基礎**：快速估算引導、估算輸入元件、資產負債表與淨值、可動用淨值、精確度、下一步建議、淨值快照與歷史曲線、財富階梯位置、備份匯出入（可加密）、PWA
- [ ] P2 分析與計畫：收支編輯、財務健檢、理財目標試算
- [ ] P3 投資組合
- [ ] P4 財富階梯行動建議、定期回顧
