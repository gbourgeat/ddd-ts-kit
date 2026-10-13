import { hasScope, isAnonymous, type SessionScope } from '@ddd-ts-kit/kernel';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { ForbiddenError } from '../../error/forbidden-error.js';
import { UnauthorizedError } from '../../error/unauthorized-error.js';
import type { Guard } from '../guard.js';

/**
 * Lets through a request whose session was granted every scope named (`Session.scopes`, the
 * `scope` claim of the token): 401 to the anonymous caller, 403 when one is missing. A scope
 * limits the client that presents the credential (a mobile application, an integration); what
 * the actor may do stays a permission of the use case.
 */
export function HasScope(...scopes: readonly SessionScope[]): Guard {
  if (scopes.length === 0) {
    throw new DeclarationError('HasScope() names no scope: name at least one, or use Authenticated.');
  }

  return {
    documents: { errors: ['UNAUTHORIZED', 'FORBIDDEN'] },
    check({ actor, session }) {
      if (isAnonymous(actor)) {
        throw new UnauthorizedError('Authentication is required');
      }

      if (!scopes.every((scope) => hasScope(session, scope))) {
        throw new ForbiddenError('A scope this route requires was not granted');
      }
    },
  };
}
