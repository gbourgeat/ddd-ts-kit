import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { DelegationGrantedPublisher } from '@/contexts/identity/application/integration/publishers/delegation-granted.publisher';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event';

describe('Publishing "delegation granted" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.delegation.granted', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new DelegationGrantedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new DelegationGranted('delegation-1', new Date('2026-01-01T00:00:00.000Z'), {
        practiceId: 'practice-1',
        practitionerId: 'person-2',
        assistantId: 'person-3',
        availabilityIncluded: true,
        endsAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
    );

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.delegation.granted',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {
          delegationId: 'delegation-1',
          practiceId: 'practice-1',
          practitionerId: 'person-2',
          assistantId: 'person-3',
          availabilityIncluded: true,
          endsAt: '2026-06-01T00:00:00.000Z',
        },
      },
    ]);
  });

  it('publishes no end for a delegation without an end', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new DelegationGrantedPublisher(bus, new SequentialIdGenerator('event'));

    const facts = {
      practiceId: 'practice-1',
      practitionerId: 'person-2',
      assistantId: 'person-3',
      availabilityIncluded: false,
      endsAt: undefined,
    };

    await publisher.handle(new DelegationGranted('delegation-1', new Date('2026-01-01T00:00:00.000Z'), facts));

    expect(bus.published).toMatchObject([{ payload: { delegationId: 'delegation-1' } }]);
    expect(bus.published[0]?.payload).not.toHaveProperty('endsAt');
  });
});
