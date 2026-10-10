import { describe, expect, it } from 'vitest';
import { PracticeMemberRemovedEventHandler } from '#src/contexts/identity/application/event-handlers/practice-member-removed.event-handler.js';
import { PracticeMemberRemoved } from '#src/contexts/identity/domain/events/practice-member-removed.event.js';
import { aDelegation } from '#src/contexts/identity/test/builders/delegation.builder.js';
import { FakeDelegationRepository } from '#src/contexts/identity/test/fakes/delegation.repository.fake.js';
import { FakeIdentityRelationships } from '#src/contexts/identity/test/fakes/identity-relationships.fake.js';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When practice member removed', () => {
  it('forgets what the member was to the practice', async () => {
    const { handler, relationships } = await arrange();

    await handler.handle(new PracticeMemberRemoved('practice-1', at, { personId: 'person-2', role: 'practitioner' }));

    expect(relationships.current).toEqual([]);
  });

  it.each([
    ['gave as a practitioner', 'person-2'],
    ['received as an assistant', 'person-3'],
  ])('ends, at the instant of the removal, the delegation the member %s', async (_which, personId) => {
    const { handler, delegations } = await arrange();

    await delegations.save(
      aDelegation().identifiedBy('delegation-1').onDesk('practice-1', 'person-2').givenTo('person-3').build(),
    );

    await handler.handle(new PracticeMemberRemoved('practice-1', at, { personId, role: 'practitioner' }));

    expect((await delegations.findById('delegation-1'))?.toState().ended).toEqual({ at, cause: 'member-removed' });
  });

  it('does nothing to the delegations of other members, of other practices, or already ended', async () => {
    const { handler, delegations } = await arrange();

    await delegations.save(
      aDelegation().identifiedBy('delegation-others').onDesk('practice-1', 'person-8').givenTo('person-9').build(),
    );

    await delegations.save(
      aDelegation().identifiedBy('delegation-elsewhere').onDesk('practice-2', 'person-2').givenTo('person-3').build(),
    );

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-ended')
        .onDesk('practice-1', 'person-2')
        .givenTo('person-3')
        .revokedAt(at)
        .build(),
    );

    await handler.handle(new PracticeMemberRemoved('practice-1', at, { personId: 'person-2', role: 'practitioner' }));

    expect(delegations.all().map((stored) => [stored.id, stored.toState().ended?.cause])).toEqual([
      ['delegation-others', undefined],
      ['delegation-elsewhere', undefined],
      ['delegation-ended', 'revoked'],
    ]);
  });
});

async function arrange() {
  const relationships = new FakeIdentityRelationships();
  const delegations = new FakeDelegationRepository();

  await relationships.recordMembership({ practiceId: 'practice-1', personId: 'person-2', role: 'practitioner' });

  return { handler: new PracticeMemberRemovedEventHandler(relationships, delegations), relationships, delegations };
}
