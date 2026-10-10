import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidWaiterError extends DomainError {
  readonly code = 'INVALID_WAITER';

  constructor(rule: string) {
    super(`A waiter ${rule}.`);
  }
}
