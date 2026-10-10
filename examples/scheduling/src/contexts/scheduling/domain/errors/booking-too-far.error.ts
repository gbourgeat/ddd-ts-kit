import { DomainError } from '@ddd-ts-kit/kernel';

export class BookingTooFarError extends DomainError {
  readonly code = 'BOOKING_TOO_FAR';

  constructor(horizon: number) {
    super(`A slot is booked at most ${horizon} minutes before it starts.`);
  }
}
