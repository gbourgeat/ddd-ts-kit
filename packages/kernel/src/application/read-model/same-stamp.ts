import type { EventStamp } from './event-stamp';

/**
 * Whether two stamps are the one stamp: the event id, the instant and the version. What a
 * conditional replace compares, in every store: a row whose version alone moved was written by
 * another event.
 */
export function sameStamp(left: EventStamp, right: EventStamp): boolean {
  return (
    left.eventId === right.eventId &&
    left.occurredAt.getTime() === right.occurredAt.getTime() &&
    left.version === right.version
  );
}
