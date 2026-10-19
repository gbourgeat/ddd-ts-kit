import type { Config } from '../config/index.js';
import { type AuthFile, authPathOf } from '../platform-auth/index.js';
import type { Workspace } from '../workspace/index.js';
import type { FolderMove } from './folder-move.js';
import { KNOWN_AUTH_FILES } from './known-auth-files.js';

/**
 * The files the kit wrote flat in `<platformDir>/auth/`, each with its folder, and the files of
 * the team placed by name (`role-grants.ts` in `roles`), unless that folder already holds one.
 */
export function authMoves(
  ws: Workspace,
  config: Config,
  placed: ReadonlyMap<string, string> = new Map(),
): FolderMove[] {
  const auth = `${config.platformDir}/auth`;
  const names = ws.list(auth);

  const known = names
    .filter((name): name is AuthFile => KNOWN_AUTH_FILES.includes(name))
    .map((name) => ({ from: `${auth}/${name}`, to: `${config.platformDir}/${authPathOf(name)}` }));

  const ours = [...placed]
    .filter(([name]) => names.includes(name))
    .map(([name, folder]) => ({ from: `${auth}/${name}`, to: `${auth}/${folder}/${name}` }));

  return [...known, ...ours].filter(({ to }) => !ws.exists(to));
}
