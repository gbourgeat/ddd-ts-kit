import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { KNOWN_AUTH_FILES } from './known-auth-files.js';

/** The files left flat in `<platformDir>/auth/` that the kit did not write: the team knows their folder. */
export function unknownAuthFiles(ws: Workspace, config: Config): string[] {
  const auth = `${config.platformDir}/auth`;

  return ws
    .list(auth)
    .filter((name) => !KNOWN_AUTH_FILES.includes(name))
    .map((name) => `${auth}/${name}`);
}
