import { isAnonymous, isTenantMember } from '@ddd-ts-kit/kernel';
import { ForbiddenError } from '../../error/forbidden-error.js';
import { UnauthorizedError } from '../../error/unauthorized-error.js';
import type { GuardAdmission } from '../guard-admission.js';
import type { Guard } from '../guard.js';

/**
 * Lets through a caller that belongs to the tenant of the request: 401 to the anonymous caller,
 * before its request is read, 403 to a request that names no tenant or to a caller of another
 * tenant. The routes of tenant data stand behind it; the routes of platform staff stand behind a
 * guard of their own, and reach tenants through an elevation, never through this one.
 */
export const TenantMember: Guard = {
  documents: { errors: ['UNAUTHORIZED', 'FORBIDDEN'] },
  admit: refuseAnonymous,
  // The tenant of the request may come from its path, read once the request is validated.
  check({ actor, context }) {
    refuseAnonymous({ actor });

    const { tenantId } = context.execution;

    if (tenantId === undefined || !isTenantMember(actor, tenantId)) {
      throw new ForbiddenError('This route serves the members of a tenant');
    }
  },
};

function refuseAnonymous({ actor }: Pick<GuardAdmission, 'actor'>): void {
  if (isAnonymous(actor)) {
    throw new UnauthorizedError('Authentication is required');
  }
}
