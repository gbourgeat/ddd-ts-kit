import { AuthorizationSetupError } from './errors.js';
import type { Permission } from './permissions.js';

/** A permission, its id, every permission of a context (`billing:*`) or everything (`*`). */
export type Grant = Permission | string;

const EVERYTHING = '*';
const GRANT_PATTERN = /^[a-z][a-z0-9-]*:(\*|[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*)$/;

export function grantPattern(grant: Grant): string {
  const pattern = typeof grant === 'string' ? grant : grant.id;
  if (pattern !== EVERYTHING && !GRANT_PATTERN.test(pattern)) {
    throw new AuthorizationSetupError(
      `"${pattern}" is not a grant: use a permission, its id, "<context>:*" or "*".`,
    );
  }
  return pattern;
}

export function grantCovers(pattern: string, permission: Permission): boolean {
  return pattern === EVERYTHING || pattern === permission.id || pattern === `${permission.context}:*`;
}
