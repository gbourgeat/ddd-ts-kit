import type { DomainEvent } from '../../domain/domain-event.js';

/** A class of `application/event-handlers/`: one handler of one domain event of its own context. */
export interface DomainEventHandler<E extends DomainEvent> {
  readonly handle: (event: E) => Promise<void>;
}
