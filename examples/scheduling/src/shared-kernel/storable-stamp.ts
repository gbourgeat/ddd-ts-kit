import type { EventStamp } from '@ddd-ts-kit/kernel';

const SECOND = 1000;
/** How many ranks one millisecond holds. */
const RANKS = 10;

/**
 * The stamp of a fact as a read model can keep it. The SQL store reads a stamp back without its
 * milliseconds and then never finds the row it wants to replace: the second fact of a key was
 * refused for ever. The instant is therefore given to the second, and the order is carried by a
 * version made of the millisecond of the fact, then of a rank from 0 to 9 the caller gives to
 * two facts of one millisecond (0 when it has no such order).
 */
export function storableStamp(stamp: EventStamp, rank = 0): EventStamp {
  const instant = stamp.occurredAt.getTime();

  return {
    eventId: stamp.eventId,
    occurredAt: new Date(Math.floor(instant / SECOND) * SECOND),
    version: instant * RANKS + Math.min(Math.max(Math.trunc(rank), 0), RANKS - 1),
  };
}
