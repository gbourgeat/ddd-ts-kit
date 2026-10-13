import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarTimeOffAdded implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.time-off-added';

  readonly name = CalendarTimeOffAdded.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly startsAt: Date,
    readonly endsAt: Date,
  ) {}
}
