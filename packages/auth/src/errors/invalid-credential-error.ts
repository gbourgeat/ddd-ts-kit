import { DomainError } from '@ddd-ts-kit/kernel';
import { UNAUTHORIZED } from './unauthenticated-error.js';

/** A credential was presented and it is not acceptable. `reason` is a stable machine code. */
export class InvalidCredentialError extends DomainError {
  readonly code = UNAUTHORIZED;

  constructor(readonly reason: string) {
    super('The credential is not valid');
  }
}
