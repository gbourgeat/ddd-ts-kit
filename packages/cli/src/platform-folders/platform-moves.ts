import path from 'node:path';
import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { FLAT_FILES } from './flat-files.js';
import type { FolderMove } from './folder-move.js';

/**
 * The files the kit wrote flat, each with its folder, and the files of the team placed by their
 * path from the platform (`auth/role-grants.ts` in `auth/roles`), unless that folder already holds one.
 */
export function platformMoves(
  ws: Workspace,
  config: Config,
  placed: ReadonlyMap<string, string> = new Map(),
): FolderMove[] {
  const platform = config.platformDir;
  const known = [...FLAT_FILES].map(([from, to]) => ({ from: `${platform}/${from}`, to: `${platform}/${to}` }));

  const ours = [...placed].map(([file, folder]) => ({
    from: `${platform}/${file}`,
    to: `${platform}/${folder}/${path.posix.basename(file)}`,
  }));

  return [...known, ...ours].filter(({ from, to }) => ws.exists(from) && !ws.exists(to));
}
