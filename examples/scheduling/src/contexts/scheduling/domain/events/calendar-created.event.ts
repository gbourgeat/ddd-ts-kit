import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CalendarCreated implements DomainEvent {
  readonly name = 'scheduling.calendar.created';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly practiceId: string,
    readonly practitionerId: string,
    readonly timeZone: string,
  ) {}
}
