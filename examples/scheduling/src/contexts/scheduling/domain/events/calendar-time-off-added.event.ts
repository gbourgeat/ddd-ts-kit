import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarTimeOffAdded implements DomainEvent {
  readonly name = 'scheduling.calendar.time-off-added';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly startsAt: Date,
    readonly endsAt: Date,
  ) {}
}
