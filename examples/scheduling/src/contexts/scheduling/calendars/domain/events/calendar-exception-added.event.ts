import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarExceptionAdded implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.exception-added';

  readonly name = CalendarExceptionAdded.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly day: string,
  ) {}
}
