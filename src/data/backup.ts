import { SCHEMA_VERSION } from './db';
import type { ExportPayload } from './repo';

// 匯出格式，見 docs/02-data-model.md 第 7 節

export const EXPORT_FORMAT = 'rough-financial-plan-export';
const PBKDF2_ITERATIONS = 310_000;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  encrypted: boolean;
  crypto?: { salt: string; iv: string; iterations: number };
  payload: ExportPayload | string;
}

export type BackupErrorCode = 'invalid_format' | 'needs_password' | 'wrong_password' | 'unsupported_version';

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(code);
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function buildExport(
  payload: ExportPayload,
  opts: { appVersion: string; password?: string },
): Promise<string> {
  const base = {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: opts.appVersion,
  } as const;

  if (!opts.password) {
    const file: ExportFile = { ...base, encrypted: false, payload };
    return JSON.stringify(file, null, 2);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(opts.password, salt, PBKDF2_ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const file: ExportFile = {
    ...base,
    encrypted: true,
    crypto: { salt: toBase64(salt), iv: toBase64(iv), iterations: PBKDF2_ITERATIONS },
    payload: toBase64(cipher),
  };
  return JSON.stringify(file, null, 2);
}

/** 只讀取檔頭，判斷是否需要密碼 */
export function inspectExport(text: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_format');
  }
  const f = parsed as Partial<ExportFile>;
  if (!f || f.format !== EXPORT_FORMAT || typeof f.schemaVersion !== 'number' || f.payload === undefined) {
    throw new BackupError('invalid_format');
  }
  if (f.schemaVersion > SCHEMA_VERSION) throw new BackupError('unsupported_version');
  return f as ExportFile;
}

export async function parseExport(text: string, password?: string): Promise<ExportPayload> {
  const file = inspectExport(text);
  let payload: unknown = file.payload;
  if (file.encrypted) {
    if (!password) throw new BackupError('needs_password');
    if (!file.crypto || typeof file.payload !== 'string') throw new BackupError('invalid_format');
    const key = await deriveKey(password, fromBase64(file.crypto.salt), file.crypto.iterations);
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.crypto.iv) }, key, fromBase64(file.payload));
      payload = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      throw new BackupError('wrong_password');
    }
  }
  return migratePayload(payload as ExportPayload, file.schemaVersion);
}

/** 舊版備份逐版升級到目前 schema */
export function migratePayload(p: ExportPayload, fromVersion: number): ExportPayload {
  if (fromVersion < 1 || fromVersion > SCHEMA_VERSION) throw new BackupError('unsupported_version');
  if (!p || !p.household || !p.settings || !Array.isArray(p.assets) || !Array.isArray(p.liabilities)) {
    throw new BackupError('invalid_format');
  }
  let out = p;
  // v1 → v2：新增理財目標
  if (fromVersion < 2) out = { ...out, goals: [] };
  // v2 → v3：新增持股明細
  if (fromVersion < 3) out = { ...out, holdings: [] };
  return out;
}
