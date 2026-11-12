import type { EventStamp } from './event-stamp';
import { MixedStampsError } from './mixed-stamps-error';

/**
 * Whether a row holding `held` is changed by an event stamped `incoming`: only a later one does.
 * Two stamps with a version are ordered by it; two without, by their instant, then by their event
 * id. Each kind is a total order of its own, so the latest of a set of stamps of one kind is the
 * same whatever the order they are compared in. One of each kind has no order: it is refused with
 * `MixedStampsError`, which names the `key` when it is given.
 */
export function isNewer(incoming: EventStamp, held: EventStamp, key?: string): boolean {
  if ((incoming.version === undefined) !== (held.version === undefined)) {
    throw new MixedStampsError(incoming, held, key);
  }

  if (incoming.version !== undefined && held.version !== undefined) {
    return incoming.version > held.version;
  }

  const later = incoming.occurredAt.getTime() - held.occurredAt.getTime();

  return later === 0 ? incoming.eventId > held.eventId : later > 0;
}
