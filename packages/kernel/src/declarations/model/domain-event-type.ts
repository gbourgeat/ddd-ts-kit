import type { DomainEvent } from '../../domain/domain-event.js';

export type DomainEventType<E extends DomainEvent> = abstract new (...args: never) => E;
