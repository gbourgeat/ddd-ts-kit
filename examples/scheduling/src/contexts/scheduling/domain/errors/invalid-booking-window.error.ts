import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidBookingWindowError extends DomainError {
  readonly code = 'INVALID_BOOKING_WINDOW';

  constructor(rule: string) {
    super(`A booking window ${rule}.`);
  }
}
