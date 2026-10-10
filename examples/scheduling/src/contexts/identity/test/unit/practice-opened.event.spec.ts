import { describe, expect, it } from 'vitest';
import { PracticeOpened } from '#src/contexts/identity/domain/events/practice-opened.event.js';

describe('PracticeOpened', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new PracticeOpened('practice-1', new Date('2026-01-01T00:00:00.000Z'), {
      name: 'Riverside',
      timeZone: 'Europe/Paris',
      managerId: 'person-1',
    });

    expect(event.name).toBe('identity.practice.opened');
    expect(event.aggregateId).toBe('practice-1');
  });
});
