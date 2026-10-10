import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { PracticeOpenedPublisher } from '@/contexts/identity/application/integration/publishers/practice-opened.publisher.js';
import { PracticeOpened } from '@/contexts/identity/domain/events/practice-opened.event.js';

describe('Publishing "practice opened" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.practice.opened', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new PracticeOpenedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new PracticeOpened('practice-1', new Date('2026-01-01T00:00:00.000Z'), {
        name: 'Riverside',
        timeZone: 'Europe/Paris',
        managerId: 'person-1',
      }),
    );

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.practice.opened',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { practiceId: 'practice-1', name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-1' },
      },
    ]);
  });
});
