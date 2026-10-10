import { describe, expect, it } from 'vitest';
import { storableStamp } from './storable-stamp.js';

describe('storableStamp', () => {
  it('gives the instant to the second and keeps the event', () => {
    const stamp = storableStamp(at('2026-03-01T08:00:00.456Z'));

    expect(stamp).toMatchObject({ eventId: 'event-1', occurredAt: new Date('2026-03-01T08:00:00.000Z') });
  });

  it('orders two facts of the same second by their millisecond', () => {
    const earlier = storableStamp(at('2026-03-01T08:00:00.123Z'));
    const later = storableStamp(at('2026-03-01T08:00:00.124Z'));

    expect(later.version).toBeGreaterThan(earlier.version ?? Number.NaN);
  });

  it('orders two facts of the same millisecond by their rank, and never past the next millisecond', () => {
    const first = storableStamp(at('2026-03-01T08:00:00.123Z'), 0);
    const last = storableStamp(at('2026-03-01T08:00:00.123Z'), 42);
    const next = storableStamp(at('2026-03-01T08:00:00.124Z'), 0);

    expect(last.version).toBeGreaterThan(first.version ?? Number.NaN);
    expect(next.version).toBeGreaterThan(last.version ?? Number.NaN);
  });
});

function at(instant: string) {
  return { eventId: 'event-1', occurredAt: new Date(instant) };
}
