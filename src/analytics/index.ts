// 匿名使用統計（見規格第 8 節）。
// 原則：只送事件名稱與列舉值，絕不送任何金額、文字標籤或可識別個人的資料。
// 事件型別刻意寫死，新增事件時必須在這裡宣告，避免不小心送出敏感資料。

import type { AssetCategory, EstimateMode, LiabilityCategory, Snapshot } from '../model/types';

type ItemKind = 'asset' | 'liability';

export type AnalyticsEvent =
  | { name: 'app_opened'; standalone: boolean }
  | { name: 'onboarding_started' }
  | { name: 'onboarding_step'; step: string }
  | { name: 'onboarding_completed'; precision_bucket: PrecisionBucket }
  | { name: 'item_saved'; kind: ItemKind; category: AssetCategory | LiabilityCategory; mode: EstimateMode; is_new: boolean }
  | { name: 'item_archived'; kind: ItemKind; category: AssetCategory | LiabilityCategory }
  | { name: 'snapshot_created'; trigger: Snapshot['trigger'] }
  | { name: 'backup_exported'; encrypted: boolean }
  | { name: 'backup_imported' }
  | { name: 'install_prompt'; outcome: 'accepted' | 'dismissed' }
  | { name: 'analytics_enabled' };

/** 精確度只送粗略分組 */
export type PrecisionBucket = '0-25' | '25-50' | '50-75' | '75-100';

export function precisionBucket(score: number): PrecisionBucket {
  if (score < 0.25) return '0-25';
  if (score < 0.5) return '25-50';
  if (score < 0.75) return '50-75';
  return '75-100';
}

interface AnalyticsConfig {
  enabled: boolean;
  installId?: string;
  locale?: string;
}

const config: AnalyticsConfig = { enabled: false };

export function configureAnalytics(patch: Partial<AnalyticsConfig>): void {
  Object.assign(config, patch);
}

const ENDPOINT: string | undefined = import.meta.env.VITE_ANALYTICS_ENDPOINT;

export function track(event: AnalyticsEvent): void {
  if (!config.enabled) return;
  const { name, ...props } = event;
  const body = {
    event: name,
    props,
    installId: config.installId,
    locale: config.locale,
    appVersion: __APP_VERSION__,
    ts: new Date().toISOString(),
  };
  if (!ENDPOINT) {
    if (import.meta.env.DEV) console.debug('[analytics]', body);
    return;
  }
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
      void fetch(ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
    }
  } catch {
    // 統計失敗不影響使用
  }
}
