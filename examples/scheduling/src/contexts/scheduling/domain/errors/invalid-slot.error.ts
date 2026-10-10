import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidSlotError extends DomainError {
  readonly code = 'INVALID_SLOT';

  constructor(reason: string) {
    super(`A slot ${reason}.`);
  }
}
