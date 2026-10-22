# 部署到 GitHub Pages

隨便理財是純靜態網站，沒有後端，直接由 GitHub Pages 免費提供。

- 網址：<https://lo-yun.github.io/rough_financial_plan/>
- 流程：推送或合併到 `main` → `.github/workflows/deploy.yml` 執行測試與建置 → 把 `dist/` 強制推送到 `gh-pages` 分支 → GitHub Pages 從 `gh-pages` 分支的根目錄提供網站。
- 也可以在 Actions 頁面手動執行「Deploy to GitHub Pages」重新部署。

## 一次性設定

如果 **Settings → Pages** 還沒啟用，請設定：

- Source：**Deploy from a branch**
- Branch：`gh-pages`，資料夾 `/ (root)`

## 設定說明

- **內容安全政策（CSP）**：GitHub Pages 不能自訂回應標頭，所以在建置時把 CSP 以 `<meta>` 加進 `index.html`（見 `vite.config.ts` 的 `cspMeta`）。其中 `connect-src 'self'` 讓網頁無法把資料送到其他網站。開發伺服器不加，因為熱更新需要行內程式碼。
- `public/.nojekyll`：關閉 GitHub Pages 的 Jekyll 處理，檔案原樣提供。
- 網址在子路徑 `/rough_financial_plan/` 下，`vite.config.ts` 使用相對路徑（`base: './'`），路由使用 `#`，不需要額外設定。
- GitHub Pages 對所有檔案的快取約 10 分鐘；Service Worker 會在背景自動更新，使用者下次開啟就會拿到新版。

## 注意事項

- **換網域等於換一個 App**：瀏覽器資料（IndexedDB）依網域分開保存。日後若改用自訂網域，使用者需要在舊網址匯出備份，再到新網址還原。
- `frame-ancestors`（禁止被其他網站嵌入）無法用 `<meta>` 設定，GitHub Pages 上暫時沒有這層保護。App 不處理登入或付款，風險低；若日後需要，可以改用能設定標頭的主機。
