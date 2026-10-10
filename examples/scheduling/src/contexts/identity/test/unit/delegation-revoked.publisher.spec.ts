import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { DelegationRevokedPublisher } from '../../application/integration/publishers/delegation-revoked.publisher.js';
import { DelegationRevoked } from '../../domain/events/delegation-revoked.event.js';

describe('Publishing "delegation revoked" to other contexts', () => {
  it('publishes, with every field of the public payload, version 1 of identity.delegation.revoked', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new DelegationRevokedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new DelegationRevoked('delegation-1', new Date('2026-01-01T00:00:00.000Z'), {
        practiceId: 'practice-1',
        practitionerId: 'person-2',
        assistantId: 'person-3',
        cause: 'expired',
      }),
    );

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'identity.delegation.revoked',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {
          delegationId: 'delegation-1',
          practiceId: 'practice-1',
          practitionerId: 'person-2',
          assistantId: 'person-3',
          cause: 'expired',
        },
      },
    ]);
  });
});
