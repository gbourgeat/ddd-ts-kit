import type { EventStamp } from './event-stamp';

/**
 * Whether a row holding `held` is changed by an event stamped `incoming`: only a later one does.
 * Two stamps with a version are ordered by it; otherwise the instants decide, then the event ids.
 * The order is total among stamps that all carry a version, and among stamps that carry none: the
 * latest of such a set is the same whatever the order they are compared in. It is not across the
 * two kinds, where the instants decide, so a key should see one kind. The one mix that is meant
 * is a deletion made outside the history of the key, such as an erasure stamped at the clock.
 */
export function isNewer(incoming: EventStamp, held: EventStamp): boolean {
  if (incoming.version !== undefined && held.version !== undefined) {
    return incoming.version > held.version;
  }

  const later = incoming.occurredAt.getTime() - held.occurredAt.getTime();

  return later === 0 ? incoming.eventId > held.eventId : later > 0;
}
