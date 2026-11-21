/**
 * 功能旗標：決定哪些功能在這個版本看得到。
 *
 * v1 只提供「估計資產負債表」（淨值頁、資產負債編輯、財富階梯摘要卡、淨值歷史與快照）
 * 與「投資儀表板」（投資頁、持股頁），以及設定。下面列出的功能預設全部關閉：
 * 只是不註冊路由、不顯示入口，程式碼、核心計算、單元測試、資料庫結構與備份都不動（決策 D21）。
 *
 * 建置時用環境變數 VITE_FEATURES 開啟：
 * - `VITE_FEATURES=all`：全部開啟（測試用，`npm run build:all`）
 * - `VITE_FEATURES=cashflow,health`：只開啟列出的功能
 *
 * 之後依使用者等級逐步開放功能時，也沿用這份清單。新增功能旗標只改 FEATURE_KEYS。
 */
export const FEATURE_KEYS = [
  /** 收支頁 `#/cashflow`、對帳檢查、收入／支出編輯 */
  'cashflow',
  /** 健檢頁 `#/health` */
  'health',
  /** 計畫頁 `#/plans`、目標編輯、設定頁的「試算假設」 */
  'plans',
  /** 淨值頁的行動卡、行動清單 `#/actions` */
  'actions',
  /** 定期回顧 `#/checkin`、回顧提醒、設定頁的回顧頻率 */
  'checkin',
  /** 財富階梯完整頁 `#/ladder`（淨值頁的摘要卡一直都在，只隱藏連結） */
  'ladderPage',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** 解析 VITE_FEATURES 的值；空白或未設定就是 v1（全部關閉） */
export function parseFeatures(raw: string | undefined): ReadonlySet<FeatureKey> {
  const value = (raw ?? '').trim();
  if (value === 'all') return new Set(FEATURE_KEYS);
  const wanted = value.split(',').map((s) => s.trim());
  return new Set(FEATURE_KEYS.filter((k) => wanted.includes(k)));
}

const enabled = parseFeatures(import.meta.env.VITE_FEATURES);

export function isEnabled(key: FeatureKey): boolean {
  return enabled.has(key);
}
