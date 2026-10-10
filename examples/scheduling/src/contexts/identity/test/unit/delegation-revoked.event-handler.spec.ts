import { describe, expect, it } from 'vitest';
import { DelegationRevokedEventHandler } from '../../application/event-handlers/delegation-revoked.event-handler.js';
import { DelegationRevoked } from '../../domain/events/delegation-revoked.event.js';
import { FakeIdentityRelationships } from '../fakes/identity-relationships.fake.js';

const at = new Date('2026-01-01T00:00:00.000Z');
const pair = { practiceId: 'practice-1', practitionerId: 'person-2', assistantId: 'person-3' };

describe('When delegation revoked', () => {
  it.each(['revoked', 'expired', 'member-removed'] as const)(
    'forgets the delegate when the delegation ended because it was %s',
    async (cause) => {
      const relationships = new FakeIdentityRelationships();
      const handler = new DelegationRevokedEventHandler(relationships);

      await relationships.recordDelegation({ ...pair, availabilityIncluded: true });

      await handler.handle(new DelegationRevoked('delegation-1', at, { ...pair, cause }));

      expect(relationships.current).toEqual([]);
    },
  );

  it('keeps the delegates of the other desks', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new DelegationRevokedEventHandler(relationships);

    await relationships.recordDelegation({ ...pair, practitionerId: 'person-9', availabilityIncluded: false });

    await handler.handle(new DelegationRevoked('delegation-1', at, { ...pair, cause: 'revoked' }));

    expect(relationships.current).toEqual(['delegate person-3 of person-9 in practice-1']);
  });
});
