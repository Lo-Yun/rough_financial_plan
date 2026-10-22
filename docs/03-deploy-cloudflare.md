# 部署到 Cloudflare Pages

隨便理財是純靜態網站，沒有後端。Cloudflare Pages 只需要幫忙建置並提供檔案，免費方案就夠用。

## 一、連接 GitHub（只需做一次）

1. 登入 [Cloudflare 控制台](https://dash.cloudflare.com/)，左側選 **Workers & Pages**。
2. 按 **Create application**，切到 **Pages** 分頁，選 **Connect to Git**（匯入既有的 Git 存放庫）。
3. 授權 Cloudflare 存取 GitHub，選擇 `Lo-Yun/rough_financial_plan`。
4. 建置設定：

   | 欄位 | 值 |
   |---|---|
   | Project name | 例如 `suibian-licai`，網址會是 `suibian-licai.pages.dev` |
   | Production branch | `main`（目前還沒有 `main`，見下方說明） |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   Node.js 版本由專案根目錄的 `.node-version`（22）決定，不需要另外設定。
5. 按 **Save and Deploy**，第一次建置約 1～2 分鐘。

### 關於 production branch

目前開發都在 `claude/gifted-goodall-rwcdlr` 分支，存放庫還沒有 `main`。可以選擇：

- **建議**：開一個 PR 把目前的分支合併成 `main`，production branch 設為 `main`。以後合併進 `main` 就自動更新正式網址。
- 先試用：production branch 直接設為 `claude/gifted-goodall-rwcdlr`，之後再到 **Settings → Builds & deployments** 改成 `main`。

其他分支的每次推送，Cloudflare 都會自動建一個預覽網址（例如 `<雜湊>.suibian-licai.pages.dev`），方便在合併前用手機測試。

## 二、專案內已準備好的設定

- `public/_headers`：建置後會複製到 `dist/_headers`，由 Cloudflare 套用。
  - **Content-Security-Policy**：只允許載入自己網域的程式與資源，`connect-src 'self'` 確保網頁無法把資料送到其他網站，與「資料只存在你的裝置上」的承諾一致。
  - `X-Frame-Options: DENY`、`frame-ancestors 'none'`：禁止被嵌入其他網站，防止點擊劫持。
  - `/assets/*` 長期快取（檔名含雜湊值，內容改變時檔名也會變）。
  - `sw.js` 與入口頁 `no-cache`：確保使用者能收到新版本。
- 路由使用網址 `#`（hash），不需要設定 SPA 重新導向。
- `vite.config.ts` 使用相對路徑（`base: './'`），放在根網域或子路徑都可以運作。

## 三、自訂網域（選用）

在 Pages 專案的 **Custom domains** 加入網域。若網域的 DNS 已在 Cloudflare，會自動設定；否則依指示加一筆 CNAME 指向 `<project>.pages.dev`。

## 四、注意事項

- **換網域等於換一個 App**：瀏覽器的資料（IndexedDB）是依網域分開保存的。從 `*.pages.dev` 換到自訂網域時，使用者需要在舊網址匯出備份，再到新網址還原。建議正式推廣前先決定好網域。
- **預覽網址各自獨立**：每個預覽網址的資料也是分開的，測試資料不會影響正式網址。
- 修改 CSP 時，記得用瀏覽器開發者工具確認沒有「Refused to load」的錯誤。
