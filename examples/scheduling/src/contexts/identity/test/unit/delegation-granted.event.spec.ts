import { describe, expect, it } from 'vitest';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event.js';

describe('DelegationGranted', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new DelegationGranted('delegation-1', new Date('2026-01-01T00:00:00.000Z'), {
      practiceId: 'practice-1',
      practitionerId: 'person-2',
      assistantId: 'person-3',
      availabilityIncluded: true,
      endsAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(event.name).toBe('identity.delegation.granted');
    expect(event.aggregateId).toBe('delegation-1');
  });
});
