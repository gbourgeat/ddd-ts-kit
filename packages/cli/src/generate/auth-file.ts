import { type AuthFile, authFileIn } from '../platform-auth/index.js';
import type { Scope } from './scope.js';

/** The path of a file of the auth of the platform, in its folder or flat as the project keeps it. */
export function authFile(scope: Scope, file: AuthFile): string {
  return authFileIn(scope.config, file, (path) => scope.ws.exists(path));
}
