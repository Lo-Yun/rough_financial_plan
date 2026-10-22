import type { LocalePack } from '../model/localePack';
import { twPack } from './tw/pack';

const packs: Record<string, LocalePack> = { [twPack.code]: twPack };

export const defaultPack = twPack;

export function getPack(code: string | undefined): LocalePack {
  return (code && packs[code]) || defaultPack;
}
