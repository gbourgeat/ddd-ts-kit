import { describe, expect, it } from 'vitest';
import { PracticeMemberAdded } from '@/contexts/identity/domain/events/practice-member-added.event.js';

describe('PracticeMemberAdded', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new PracticeMemberAdded('practice-1', new Date('2026-01-01T00:00:00.000Z'), {
      personId: 'person-2',
      role: 'practitioner',
      displayName: 'Grace Hopper',
      timeZone: 'Europe/Paris',
    });

    expect(event.name).toBe('identity.practice.member-added');
    expect(event.aggregateId).toBe('practice-1');
  });
});
