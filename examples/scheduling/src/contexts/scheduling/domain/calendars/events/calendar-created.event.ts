import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarCreated implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.created';

  readonly name = CalendarCreated.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly practiceId: string,
    readonly practitionerId: string,
    readonly timeZone: string,
  ) {}
}
