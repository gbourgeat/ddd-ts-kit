import { DomainError } from '../../domain/errors/domain-error';

/**
 * Tenant-scoped storage was reached by work that names no tenant: the caller belongs to none yet, or
 * a job that should run per tenant does not. A refusal, answered 403 at the edge.
 */
export class NoCurrentTenantError extends DomainError {
  readonly code = 'FORBIDDEN';

  constructor() {
    super('No current tenant: the execution context of this work names none');
  }
}
