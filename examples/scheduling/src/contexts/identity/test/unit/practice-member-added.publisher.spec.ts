import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { PracticeMemberAddedPublisher } from '../../application/integration/publishers/practice-member-added.publisher.js';
import { PracticeMemberAdded } from '../../domain/events/practice-member-added.event.js';

describe('Publishing "practice member added" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.practice.member-added', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new PracticeMemberAddedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new PracticeMemberAdded('practice-1', new Date('2026-01-01T00:00:00.000Z'), { personId: 'person-2', role: 'practitioner', displayName: 'Grace Hopper', timeZone: 'Europe/Paris' }));

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.practice.member-added',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { practiceId: 'practice-1', personId: 'person-2', role: 'practitioner', displayName: 'Grace Hopper', timeZone: 'Europe/Paris' },
      },
    ]);
  });
});
