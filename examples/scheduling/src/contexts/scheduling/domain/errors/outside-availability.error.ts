import { DomainError } from '@ddd-ts-kit/kernel';

export class OutsideAvailabilityError extends DomainError {
  readonly code = 'OUTSIDE_AVAILABILITY';

  constructor(startsAt: Date) {
    super(`The calendar takes no appointment at ${startsAt.toISOString()}.`);
  }
}
