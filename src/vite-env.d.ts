/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** 匿名使用統計的收集端點；未設定時不送出任何資料 */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}
