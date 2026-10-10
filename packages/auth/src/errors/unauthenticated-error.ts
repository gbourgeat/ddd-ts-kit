import { DomainError } from '@ddd-ts-kit/kernel';

/**
 * The code `UnauthorizedError` of @ddd-ts-kit/http carries, so its default error mapping
 * answers 401 for the errors of this package with no extra wiring.
 */
export const UNAUTHORIZED = 'UNAUTHORIZED';

/** Nobody is authenticated and the use case is not public. */
export class UnauthenticatedError extends DomainError {
  readonly code = UNAUTHORIZED;

  constructor() {
    super('Authentication is required');
  }
}
