import type { DomainEventPhase } from '../../application/events/domain-event-phase';
import type { DomainEvent } from '../../domain/domain-event';
import type { Token } from '../token/token';
import type { DomainEventHandlerUse } from './domain-event-handler-use';
import type { DomainEventType } from './domain-event-type';

export interface DomainEventHandlerDeclaration {
  readonly role: 'domain-event-handler';
  /** The `name` the events of this type carry: what the dispatcher routes by. */
  readonly name: string;
  readonly phase: DomainEventPhase;
  readonly event: DomainEventType<DomainEvent>;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
  /** Hands the event type and the class to `use`, with the event type the two share. */
  pair<Outcome>(use: DomainEventHandlerUse<Outcome>): Outcome;
}
