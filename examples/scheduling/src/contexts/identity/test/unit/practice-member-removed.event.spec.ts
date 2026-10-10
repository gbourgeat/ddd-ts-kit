import { describe, expect, it } from 'vitest';
import { PracticeMemberRemoved } from '@/contexts/identity/domain/events/practice-member-removed.event.js';

describe('PracticeMemberRemoved', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new PracticeMemberRemoved('practice-1', new Date('2026-01-01T00:00:00.000Z'), {
      personId: 'person-2',
      role: 'practitioner',
    });

    expect(event.name).toBe('identity.practice.member-removed');
    expect(event.aggregateId).toBe('practice-1');
  });
});
