import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarOpeningHoursSet implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.opening-hours-set';

  readonly name = CalendarOpeningHoursSet.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
