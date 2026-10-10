import { DomainError } from '@ddd-ts-kit/kernel';

export class BookingTooLateError extends DomainError {
  readonly code = 'BOOKING_TOO_LATE';

  constructor(notice: number) {
    super(`A slot is booked at least ${notice} minutes before it starts.`);
  }
}
