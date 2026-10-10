import type { DomainEvent } from '../../domain/domain-event.js';

/** What a dispatcher is given for one event name: the function it calls with each event. */
export type DomainEventCallback<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>;
