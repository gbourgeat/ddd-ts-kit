import type { DomainEvent } from '../../../../src/index.js';
import { DomainEventHandler, On } from '../../../../src/declarations.js';

/** A name typed `string` and empty when it is read: the compiler cannot see it, the decorator refuses it. */
class VisitWithoutAName implements DomainEvent {
  static readonly eventName: string = '';

  readonly name = VisitWithoutAName.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

export function declareAHandlerOfAnUnnamedEvent(): void {
  DomainEventHandler(VisitWithoutAName);
}

export function declareAProjectionOfAnUnnamedEvent(): void {
  On(VisitWithoutAName);
}
