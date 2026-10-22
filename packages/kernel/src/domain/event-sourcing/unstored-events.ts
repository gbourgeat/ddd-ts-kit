import type { DomainEvent } from '../domain-event';

/**
 * The events an event-sourced aggregate recorded since it was loaded or last stored, kept out of
 * the aggregate so that nothing public exposes them: the aggregate adds, `appendChanges` hands
 * them to the store and clears them.
 */
export const unstoredEvents = new WeakMap<object, DomainEvent[]>();
