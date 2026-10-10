import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarExceptionAdded implements DomainEvent {
  readonly name = 'scheduling.calendar.exception-added';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly day: string,
  ) {}
}
