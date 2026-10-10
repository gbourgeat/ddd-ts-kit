import { describe, expect, it } from 'vitest';
import { PracticeMemberAddedEventHandler } from '../../application/event-handlers/practice-member-added.event-handler.js';
import { PracticeMemberAdded } from '../../domain/events/practice-member-added.event.js';
import { FakeIdentityRelationships } from '../fakes/identity-relationships.fake.js';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When practice member added', () => {
  it.each(['manager', 'practitioner', 'assistant'] as const)('records the new member as %s of the practice', async (role) => {
    const relationships = new FakeIdentityRelationships();
    const handler = new PracticeMemberAddedEventHandler(relationships);

    await handler.handle(new PracticeMemberAdded('practice-1', at, { personId: 'person-2', role, displayName: 'Grace Hopper', timeZone: 'Europe/Paris' }));

    expect(relationships.current).toEqual([`${role} person-2 of practice-1`]);
  });

  it('keeps what the other members are to the practice', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new PracticeMemberAddedEventHandler(relationships);

    await relationships.recordMembership({ practiceId: 'practice-1', personId: 'person-1', role: 'manager' });

    await handler.handle(new PracticeMemberAdded('practice-1', at, { personId: 'person-2', role: 'assistant', displayName: 'Grace Hopper', timeZone: 'Europe/Paris' }));

    expect(relationships.current).toEqual(['assistant person-2 of practice-1', 'manager person-1 of practice-1']);
  });
});
