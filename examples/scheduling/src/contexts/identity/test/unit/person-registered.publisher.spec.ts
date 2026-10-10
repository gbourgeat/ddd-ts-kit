import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { PersonRegisteredPublisher } from '#src/contexts/identity/application/integration/publishers/person-registered.publisher.js';
import { PersonRegistered } from '#src/contexts/identity/domain/events/person-registered.event.js';

describe('Publishing "person registered" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.person.registered', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new PersonRegisteredPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new PersonRegistered('person-1', new Date('2026-01-01T00:00:00.000Z'), {
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
      }),
    );

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.person.registered',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { personId: 'person-1', displayName: 'Ada Lovelace', email: 'ada@example.com' },
      },
    ]);
  });
});
