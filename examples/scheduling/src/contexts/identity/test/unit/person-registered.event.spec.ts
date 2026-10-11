import { describe, expect, it } from 'vitest';
import { PersonRegistered } from '@/contexts/identity/domain/events/person-registered.event';

describe('PersonRegistered', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new PersonRegistered('person-1', new Date('2026-01-01T00:00:00.000Z'), {
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    });

    expect(event.name).toBe('identity.person.registered');
    expect(event.aggregateId).toBe('person-1');
  });
});
