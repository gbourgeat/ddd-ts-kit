import { describe, expect, it } from 'vitest';
import { DelegationGrantedEventHandler } from '@/contexts/identity/application/event-handlers/delegation-granted.event-handler';
import { DelegationGranted } from '@/contexts/identity/domain/events/delegation-granted.event';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake';

const at = new Date('2026-01-01T00:00:00.000Z');
const facts = { practiceId: 'practice-1', practitionerId: 'person-2', assistantId: 'person-3', endsAt: undefined };

describe('When delegation granted', () => {
  it('records the assistant as a delegate on the desk of the practitioner', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new DelegationGrantedEventHandler(relationships);

    await handler.handle(new DelegationGranted('delegation-1', at, { ...facts, availabilityIncluded: false }));

    expect(relationships.current).toEqual(['delegate person-3 of person-2 in practice-1']);
  });

  it('records that the delegate may change the availability when the delegation includes it', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new DelegationGrantedEventHandler(relationships);

    await handler.handle(new DelegationGranted('delegation-1', at, { ...facts, availabilityIncluded: true }));

    expect(relationships.current).toEqual(['delegate person-3 of person-2 in practice-1 with availability']);
  });
});
