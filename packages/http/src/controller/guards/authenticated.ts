import { isAnonymous } from '@ddd-ts-kit/kernel';
import { UnauthorizedError } from '../../error/unauthorized-error.js';
import type { Guard } from '../guard.js';

/** Lets through every caller the application authenticated, whoever it is; answers 401 to the anonymous one. */
export const Authenticated: Guard = {
  documents: { errors: ['UNAUTHORIZED'] },
  check({ actor }) {
    if (isAnonymous(actor)) {
      throw new UnauthorizedError('Authentication is required');
    }
  },
};
