import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { AddMemberCommand } from '@/contexts/identity/application/commands/add-member/add-member.command';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';
import { aPractice } from '@/contexts/identity/test/builders/practice.builder';
import { anIdentityWorld, type IdentityWorldOptions } from '@/contexts/identity/test/worlds/identity.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['member.add']] } }),
});

const holder = anActor().withRole('holder').build();

describe('Add member', () => {
  it('saves the practice and answers the identifier of the new member', async () => {
    const { application, practiceRepository } = await arrangeWithPractice();

    const id = await application.commandBus.execute(
      new AddMemberCommand(holder, 'practice-7', { personId: 'person-grace', role: 'practitioner' }),
    );

    expect(id).toBe('person-grace');
    expect((await practiceRepository.findById('practice-7'))?.members).toHaveLength(2);
  });

  it('is refused to an actor who does not hold the permission member.add', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(
        new AddMemberCommand(anActor().build(), 'practice-7', { personId: 'person-grace', role: 'practitioner' }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('makes a registered person a practitioner of the practice, holder of their desk, and tells the other contexts', async () => {
    const { application, relationships } = await arrangeWithPractice();
    const before = application.eventBus.published.length;

    await application.commandBus.execute(
      new AddMemberCommand(holder, 'practice-7', { personId: 'person-grace', role: 'practitioner' }),
    );

    expect(relationships.current).toContain('practitioner person-grace of practice-7');

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.practice.member-added',
        payload: {
          practiceId: 'practice-7',
          personId: 'person-grace',
          role: 'practitioner',
          displayName: 'Grace Hopper',
          timeZone: 'Europe/Paris',
        },
      },
    ]);
  });

  it.each([
    {
      what: 'a person who is already a member',
      practiceId: 'practice-7',
      personId: 'person-ada',
      role: 'assistant',
      code: 'ALREADY_MEMBER',
    },
    {
      what: 'a person who is not registered',
      practiceId: 'practice-7',
      personId: 'stranger',
      role: 'assistant',
      code: 'PERSON_NOT_REGISTERED',
    },
    {
      what: 'a role nobody has in a practice',
      practiceId: 'practice-7',
      personId: 'person-grace',
      role: 'patient',
      code: 'UNKNOWN_ROLE',
    },
    {
      what: 'a practice that does not exist',
      practiceId: 'practice-9',
      personId: 'person-grace',
      role: 'assistant',
      code: 'PRACTICE_NOT_FOUND',
    },
  ])('refuses $what, and saves and publishes nothing', async ({ practiceId, personId, role, code }) => {
    const { application, practiceRepository } = await arrangeWithPractice();
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new AddMemberCommand(holder, practiceId, { personId, role })),
    ).rejects.toMatchObject({ code });

    expect((await practiceRepository.findById('practice-7'))?.members).toHaveLength(1);
    expect(application.eventBus.published).toHaveLength(before);
  });
});

async function arrangeWithPractice() {
  return arrange(async (fakes) => {
    await fakes.personRepository.save(aPerson().identifiedBy('person-ada').build());
    await fakes.personRepository.save(aPerson().identifiedBy('person-grace').named('Grace Hopper').build());

    await fakes.practiceRepository.save(
      aPractice().identifiedBy('practice-7').inTimeZone('Europe/Paris').managedBy('person-ada').build(),
    );
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
