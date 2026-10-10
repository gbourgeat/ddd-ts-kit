import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { PracticeMemberRemovedPublisher } from '../../application/integration/publishers/practice-member-removed.publisher.js';
import { PracticeMemberRemoved } from '../../domain/events/practice-member-removed.event.js';

describe('Publishing "practice member removed" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.practice.member-removed', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new PracticeMemberRemovedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new PracticeMemberRemoved('practice-1', new Date('2026-01-01T00:00:00.000Z'), { personId: 'person-2', role: 'practitioner' }));

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.practice.member-removed',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { practiceId: 'practice-1', personId: 'person-2', role: 'practitioner' },
      },
    ]);
  });
});
