import { DomainError } from '@ddd-ts-kit/kernel';

/** A request that names a tenant outside the grammar of `isTenantId`: no such tenant can exist. */
export class UnknownTenantError extends DomainError {
  readonly code = 'NOT_FOUND';
}
