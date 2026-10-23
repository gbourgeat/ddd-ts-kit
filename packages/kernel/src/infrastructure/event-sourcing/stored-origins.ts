import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { DomainEvent } from '../../domain/domain-event';

/** The stored event each domain event was read from, for `storedStampOf`. */
export const storedOrigins = new WeakMap<DomainEvent, StoredEvent>();
