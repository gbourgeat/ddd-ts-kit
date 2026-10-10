import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarOpeningHoursSet implements DomainEvent {
  readonly name = 'scheduling.calendar.opening-hours-set';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
