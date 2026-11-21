/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** 功能旗標，見 src/app/features.ts */
  readonly VITE_FEATURES?: string;
}
