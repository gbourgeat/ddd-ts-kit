import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import type { Grant } from './grant.js';

/** The pattern that grants every permission of every context. */
export const EVERYTHING = '*';

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
