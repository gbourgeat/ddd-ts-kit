import { AUTH_FOLDERS } from './auth-folders.js';
import type { AuthFile } from './auth-file.js';

/** Where a file of the auth of the platform lives, relative to the platform: `auth/<folder>/<file>`. */
export function authPathOf(file: AuthFile): string {
  const folder = Object.entries(AUTH_FOLDERS).find(([, files]) => files.some((name) => name === file))?.[0];

  return folder === undefined ? `auth/${file}` : `auth/${folder}/${file}`;
}
