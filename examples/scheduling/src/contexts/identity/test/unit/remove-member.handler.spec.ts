import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { identityPermissions } from '@/contexts/identity/identity.permissions';
import { RemoveMemberCommand } from '@/contexts/identity/application/commands/remove-member/remove-member.command';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { aPractice } from '@/contexts/identity/test/builders/practice.builder';
import { anIdentityWorld, type IdentityWorldOptions } from '@/contexts/identity/test/worlds/identity.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['member.remove']] } }),
});

const holder = anActor().withRole('holder').build();

describe('Remove member', () => {
  it('saves the practice and answers the identifier of the person removed', async () => {
    const { application, practiceRepository } = await arrangeWithPractice();

    const id = await application.commandBus.execute(new RemoveMemberCommand(holder, 'practice-7', 'person-grace'));

    expect(id).toBe('person-grace');
    expect((await practiceRepository.findById('practice-7'))?.members).toHaveLength(2);
  });

  it('is refused to an actor who does not hold the permission member.remove', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(anActor().build(), 'practice-7', 'person-grace')),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('ends the membership, forgets what the member was to the practice, and tells the other contexts', async () => {
    const { application, relationships } = await arrangeWithPractice();
    const before = application.eventBus.published.length;

    await application.commandBus.execute(new RemoveMemberCommand(holder, 'practice-7', 'person-linus'));

    expect(relationships.current).not.toContain('assistant person-linus of practice-7');

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.practice.member-removed',
        payload: { practiceId: 'practice-7', personId: 'person-linus', role: 'assistant' },
      },
    ]);
  });

  it.each([
    ['the practitioner who gave it', 'person-grace'],
    ['the assistant who received it', 'person-linus'],
  ])('revokes a delegation when %s is removed, with the cause member-removed', async (_who, personId) => {
    const { application, delegationRepository, relationships } = await arrangeWithPractice();

    await delegationRepository.save(
      aDelegation().identifiedBy('delegation-1').onDesk('practice-7', 'person-grace').givenTo('person-linus').build(),
    );

    const before = application.eventBus.published.length;

    await application.commandBus.execute(new RemoveMemberCommand(holder, 'practice-7', personId));

    expect((await delegationRepository.findById('delegation-1'))?.isActive).toBe(false);
    expect(relationships.current).not.toContain('delegate person-linus of person-grace in practice-7');

    expect(application.eventBus.published.slice(before)).toMatchObject([
      { type: 'identity.practice.member-removed' },
      { type: 'identity.delegation.revoked', payload: { delegationId: 'delegation-1', cause: 'member-removed' } },
    ]);
  });

  it('leaves alone the delegations of the same people in another practice', async () => {
    const { application, delegationRepository } = await arrangeWithPractice();

    await delegationRepository.save(
      aDelegation().identifiedBy('delegation-2').onDesk('practice-8', 'person-grace').givenTo('person-linus').build(),
    );

    await application.commandBus.execute(new RemoveMemberCommand(holder, 'practice-7', 'person-grace'));

    expect((await delegationRepository.findById('delegation-2'))?.isActive).toBe(true);
  });

  it.each([
    {
      whom: 'the last manager of the practice',
      practiceId: 'practice-7',
      personId: 'person-ada',
      code: 'LAST_MANAGER',
    },
    { whom: 'someone who is not a member', practiceId: 'practice-7', personId: 'stranger', code: 'NOT_A_MEMBER' },
    {
      whom: 'a member of a practice that does not exist',
      practiceId: 'practice-9',
      personId: 'person-grace',
      code: 'PRACTICE_NOT_FOUND',
    },
  ])('refuses to remove $whom, and saves and publishes nothing', async ({ practiceId, personId, code }) => {
    const { application, practiceRepository } = await arrangeWithPractice();
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(holder, practiceId, personId)),
    ).rejects.toMatchObject({ code });

    expect((await practiceRepository.findById('practice-7'))?.members).toHaveLength(3);
    expect(application.eventBus.published).toHaveLength(before);
  });
});

async function arrangeWithPractice() {
  return arrange(async (fakes) => {
    const practice = aPractice()
      .identifiedBy('practice-7')
      .managedBy('person-ada')
      .withPractitioner('person-grace')
      .withAssistant('person-linus');

    await fakes.practiceRepository.save(practice.build());
  });
}

async function arrange(given: NonNullable<IdentityWorldOptions['given']> = async () => undefined) {
  const { identityRelationships: relationships, ...arranged } = await anIdentityWorld({
    modules: [holders],
    idPrefix: 'practice',
    given,
  });

  return { ...arranged, relationships };
}
