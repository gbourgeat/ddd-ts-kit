import type fs from 'node:fs';

/** Whether a stat is the mask of the sandbox: a character device, mode `c`, bound over a path it denies. */
export function isSandboxMask(stat: Pick<fs.Stats, 'isCharacterDevice'>): boolean {
  return stat.isCharacterDevice();
}
