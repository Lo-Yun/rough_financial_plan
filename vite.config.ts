/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// GitHub Pages 無法設定回應標頭，改用 <meta> 設定內容安全政策。
// connect-src 'self' 讓網頁無法把資料送到其他網站。只在建置時加入，開發伺服器需要行內程式碼。
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspMeta: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // 相對路徑，方便部署到任何靜態主機（含子路徑）
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    cspMeta,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '順便理財',
        short_name: '順便理財',
        description: '用差不多的數字，看懂你的財務',
        lang: 'zh-TW',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f6f2',
        theme_color: '#2f6b4f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    // 主程式約 180 KB（gzip），大部分是 React 與路由套件本身，無法再延遲載入。
    // 框架另外打包成 vendor，之後 App 更新時使用者不必重新下載它。
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|dexie|dexie-react-hooks|i18next|react-i18next)\//.test(id)
            ? 'vendor'
            : undefined,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
