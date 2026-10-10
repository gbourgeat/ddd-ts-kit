import { DomainError } from '@ddd-ts-kit/kernel';

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}
