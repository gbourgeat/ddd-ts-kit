import type { EventStamp } from '../../application/read-model/event-stamp';
import type { DomainEvent } from '../../domain/domain-event';
import { storedOrigins } from './stored-origins';

/**
 * The stamp of a domain event read from an event store, for the row of a read model it changes:
 * the id of the stored event, its instant and its version in its stream, so that the rows of one
 * stream are ordered by the stream and not by clocks. `undefined` for an event that was not read
 * from a store (dispatched by a save): a projection fed both ways falls back to `stampOf`.
 */
export function storedStampOf(event: DomainEvent): EventStamp | undefined {
  const stored = storedOrigins.get(event);

  return stored === undefined
    ? undefined
    : { eventId: stored.id, occurredAt: stored.occurredAt, version: stored.version };
}
