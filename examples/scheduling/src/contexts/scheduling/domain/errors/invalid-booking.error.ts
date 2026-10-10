import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidBookingError extends DomainError {
  readonly code = 'INVALID_BOOKING';

  constructor(reason: string) {
    super(`A booking ${reason}.`);
  }
}
