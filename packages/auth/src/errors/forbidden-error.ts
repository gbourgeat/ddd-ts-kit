import { DomainError } from '@ddd-ts-kit/kernel';

/**
 * The code `ForbiddenError` of @ddd-ts-kit/http carries, so its default error mapping answers
 * 403 for the error below with no extra wiring.
 */
export const FORBIDDEN = 'FORBIDDEN';

/** The actor is known and may not do this. `reason` is a stable machine code, never data. */
export class ForbiddenError extends DomainError {
  readonly code = FORBIDDEN;

  constructor(
    readonly permissionId: string,
    readonly reason: string,
  ) {
    super(`Permission ${permissionId} is not granted`);
  }
}
