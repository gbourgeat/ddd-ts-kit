import type { DomainEvent } from '../../../../../../../src';

export class VisitScheduled implements DomainEvent {
  static readonly eventName = 'clinic.visit.scheduled';

  readonly name = VisitScheduled.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
