/**
 * How a projection receives the domain events of its context. `dispatch`, the default: where they
 * are dispatched, inside the save, in its transaction. `event-store`: from the event store, by a
 * catch-up subscription under the name of the projection, which keeps a checkpoint and can rebuild
 * the read model from position zero; the dispatcher does not call it.
 */
export type ProjectionFeed = 'dispatch' | 'event-store';
