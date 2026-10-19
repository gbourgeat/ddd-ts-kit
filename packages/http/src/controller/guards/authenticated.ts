import { isAnonymous } from '@ddd-ts-kit/kernel';
import { UnauthorizedError } from '../../error/unauthorized-error.js';
import type { GuardAdmission } from '../guard-admission.js';
import type { Guard } from '../guard.js';

/**
 * Lets through every caller the application authenticated, whoever it is; answers 401 to the
 * anonymous one, before its request is read.
 */
export const Authenticated: Guard = {
  documents: { errors: ['UNAUTHORIZED'] },
  admit: refuseAnonymous,
  check: refuseAnonymous,
};

function refuseAnonymous({ actor }: GuardAdmission): void {
  if (isAnonymous(actor)) {
    throw new UnauthorizedError('Authentication is required');
  }
}
