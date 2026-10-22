import { describe, expect, it } from 'vitest';
import { WaitlistJoined } from '@/contexts/scheduling/domain/waitlist/events/waitlist-joined.event';

describe('WaitlistJoined', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new WaitlistJoined('waitlist-1', new Date('2026-01-01T00:00:00.000Z'), 'patient-1', 'type-1');

    expect(event.name).toBe('scheduling.waitlist.joined');
    expect(event.aggregateId).toBe('waitlist-1');
  });
});
