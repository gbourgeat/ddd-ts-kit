import type { Config } from '../config/index.js';
import type { AuthFile } from './auth-file.js';
import { authPathOf } from './auth-path-of.js';

/**
 * The path of a file of the auth of the platform in this project. A project generated before the
 * folders keeps every file flat in `<platformDir>/auth/`, its authorizer among them: there, a file
 * that is not in its folder is read and written flat, until the team moves them.
 */
export function authFileIn(config: Config, file: AuthFile, exists: (path: string) => boolean): string {
  const placed = `${config.platformDir}/${authPathOf(file)}`;
  const flat = `${config.platformDir}/auth/${file}`;

  if (exists(placed)) {
    return placed;
  }

  return exists(flat) || exists(`${config.platformDir}/auth/create-authorizer.ts`) ? flat : placed;
}
