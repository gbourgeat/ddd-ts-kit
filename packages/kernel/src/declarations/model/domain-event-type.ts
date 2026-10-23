import type { DomainEvent } from '../../domain/domain-event';

export type DomainEventType<E extends DomainEvent> = abstract new (...args: never) => E;
