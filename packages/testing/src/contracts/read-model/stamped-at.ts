import type { EventStamp } from '@ddd-ts-kit/kernel';

/** The stamp of an event that occurred at this minute of the hour the contract plays in. */
export function stampedAt(eventId: string, minute: number): EventStamp {
  return { eventId, occurredAt: new Date(Date.UTC(2026, 9, 10, 12, minute)) };
}
