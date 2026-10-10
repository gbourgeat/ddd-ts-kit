import type { DomainEvent } from '../../../../../../../src/index.js';

export class VisitScheduled implements DomainEvent {
  readonly name = 'clinic.visit.scheduled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
