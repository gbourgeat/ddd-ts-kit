import type { DomainEvent } from '../../domain/domain-event.js';
import type { IntegrationEvent } from '../events/integration-event.js';
import type { EventStamp } from './event-stamp.js';

/**
 * The stamp of an event, for the row it changes. An integration event gives its id and
 * instant; a domain event, which has no id, is known by its name and aggregate. Pass the
 * per-key `version` when the event carries one: the order then no longer relies on clocks.
 */
export function stampOf(event: IntegrationEvent | DomainEvent, version?: number): EventStamp {
  const stamp =
    typeof event.occurredAt === 'string'
      ? { eventId: 'id' in event ? event.id : '', occurredAt: new Date(event.occurredAt) }
      : { eventId: 'name' in event ? `${event.name}:${event.aggregateId}` : '', occurredAt: event.occurredAt };

  return version === undefined ? stamp : { ...stamp, version };
}
