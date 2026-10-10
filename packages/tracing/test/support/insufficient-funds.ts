import { DomainError } from '@ddd-ts-kit/kernel';

export class InsufficientFunds extends DomainError {
  readonly code = 'INSUFFICIENT_FUNDS';
}
