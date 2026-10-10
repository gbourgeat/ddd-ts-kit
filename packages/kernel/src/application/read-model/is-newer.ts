import type { EventStamp } from './event-stamp.js';

/** Whether a row holding `held` is changed by an event stamped `incoming`: only a later one does. */
export function isNewer(incoming: EventStamp, held: EventStamp): boolean {
  if (incoming.version !== undefined && held.version !== undefined) {
    return incoming.version > held.version;
  }

  const later = incoming.occurredAt.getTime() - held.occurredAt.getTime();

  return later === 0 ? incoming.eventId > held.eventId : later > 0;
}
