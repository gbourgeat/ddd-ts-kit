import { DomainError } from '@ddd-ts-kit/kernel';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}
