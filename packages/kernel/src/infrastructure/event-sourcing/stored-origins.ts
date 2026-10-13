import type { StoredEvent } from '../../application/event-sourcing/stored-event.js';
import type { DomainEvent } from '../../domain/domain-event.js';

/** The stored event each domain event was read from, for `storedStampOf`. */
export const storedOrigins = new WeakMap<DomainEvent, StoredEvent>();
