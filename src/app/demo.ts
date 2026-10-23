import Dexie from 'dexie';
import type { Repo } from '../data/repo';
import type { LocalePack } from '../model/localePack';
import type { Household, ISODate } from '../model/types';

// 示範資料模式（規格 4.11）：改用另一個資料庫，真實資料完全不會被讀寫。
// 旗標存在 sessionStorage：關掉分頁或重新開啟 App 就回到真實資料，不會有人忘了自己在示範模式。

const FLAG = 'rfp.demo';
export const REAL_DB_NAME = 'rough-financial-plan';
export const DEMO_DB_NAME = 'rough-financial-plan-demo';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 瀏覽器不允許 sessionStorage 時（例如部分隱私模式）無法切換，就不提供示範 */
export function canUseDemo(): boolean {
  return storage() !== null;
}

export function isDemoMode(): boolean {
  try {
    return storage()?.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function restartAt(flag: boolean) {
  try {
    if (flag) storage()?.setItem(FLAG, '1');
    else storage()?.removeItem(FLAG);
  } catch {
    return;
  }
  window.location.hash = '#/';
  window.location.reload();
}

const SPLASH_FLAG = 'rfp.splashSeen';

/** 歡迎品牌頁在同一個分頁只出現一次：離開示範後重新載入，直接回到「開始估算」 */
export function hasSeenSplash(): boolean {
  try {
    return storage()?.getItem(SPLASH_FLAG) === '1';
  } catch {
    return false;
  }
}

export function markSplashSeen(): void {
  try {
    storage()?.setItem(SPLASH_FLAG, '1');
  } catch {
    return;
  }
}

export function enterDemo(): void {
  restartAt(true);
}

export function exitDemo(): void {
  restartAt(false);
}

/** 每次進入示範模式都重新產生資料，示範中做的修改不會留下來 */
export async function seedDemo(repo: Repo, pack: LocalePack, today: ISODate): Promise<Household> {
  const { buildTwDemo } = await import('../locales/tw/demo');
  const payload = buildTwDemo(pack, today);
  await repo.importAll(payload);
  return payload.household;
}

/** 在一般模式下清掉上次示範留下的資料庫 */
export function discardDemoData(): void {
  void Dexie.delete(DEMO_DB_NAME).catch(() => undefined);
}
