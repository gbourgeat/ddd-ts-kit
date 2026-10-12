import { isAnonymous } from '@ddd-ts-kit/kernel';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { ForbiddenError } from '../../error/forbidden-error.js';
import { UnauthorizedError } from '../../error/unauthorized-error.js';
import type { Guard } from '../guard.js';

/**
 * Lets through a caller that holds one of the roles, as its `Actor` carries them: 401 to the
 * anonymous caller, 403 to one that holds none. A coarse control over a set of routes; what a
 * role may do to one element stays a permission of the use case.
 */
export function HasRole(...roles: readonly string[]): Guard {
  if (roles.length === 0) {
    throw new DeclarationError('HasRole() names no role: name at least one, or use Authenticated.');
  }

  return {
    documents: { errors: ['UNAUTHORIZED', 'FORBIDDEN'] },
    check({ actor }) {
      if (isAnonymous(actor)) {
        throw new UnauthorizedError('Authentication is required');
      }

      if (!roles.some((role) => actor.roles.includes(role))) {
        throw new ForbiddenError('A role this route requires is missing');
      }
    },
  };
}
