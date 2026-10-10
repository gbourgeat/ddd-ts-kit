import type { DomainEvent } from '../../domain/domain-event.js';
import type { Token } from '../token/token.js';
import type { DomainEventHandlerUse } from './domain-event-handler-use.js';
import type { DomainEventType } from './domain-event-type.js';

export interface DomainEventHandlerDeclaration {
  readonly role: 'domain-event-handler';
  /** The `name` the events of this type carry: what the dispatcher routes by. */
  readonly name: string;
  readonly event: DomainEventType<DomainEvent>;
  readonly dependencies: readonly Token<unknown>[];
  /** Hands the event type and the class to `use`, with the event type the two share. */
  pair<Outcome>(use: DomainEventHandlerUse<Outcome>): Outcome;
}
