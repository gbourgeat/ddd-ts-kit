import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { GrantDelegationCommand } from '@/contexts/identity/application/commands/grant-delegation/grant-delegation.command';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { aPractice } from '@/contexts/identity/test/builders/practice.builder';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake';
import { FakePracticeRepository } from '@/contexts/identity/test/fakes/practice.repository.fake';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['delegation.grant']] } }),
});

const holder = anActor().withRole('holder').build();

const desk = { practiceId: 'practice-7', practitionerId: 'person-grace' };
const terms = { assistantId: 'person-linus', availabilityIncluded: false };

describe('Grant delegation', () => {
  it('saves the delegation and answers its identifier', async () => {
    const { application, delegationRepository } = await arrangeWithPractice();

    const id = await application.commandBus.execute(new GrantDelegationCommand(holder, desk, terms));

    expect(id).toMatch(/^delegation-\d+$/);
    expect(await delegationRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission delegation.grant', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(new GrantDelegationCommand(anActor().build(), desk, terms)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('gives the assistant the desk of the practitioner until its end, availability included, and tells the other contexts', async () => {
    const { application, delegationRepository, relationships } = await arrangeWithPractice();
    const endsAt = new Date(application.clock.now().getTime() + 86_400_000);
    const before = application.eventBus.published.length;

    const id = await application.commandBus.execute(
      new GrantDelegationCommand(holder, desk, { ...terms, availabilityIncluded: true, endsAt }),
    );

    expect((await delegationRepository.findById(id))?.isActive).toBe(true);
    expect(relationships.current).toContain('delegate person-linus of person-grace in practice-7 with availability');

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.delegation.granted',
        payload: {
          delegationId: id,
          practiceId: 'practice-7',
          practitionerId: 'person-grace',
          assistantId: 'person-linus',
          availabilityIncluded: true,
          endsAt: endsAt.toISOString(),
        },
      },
    ]);
  });

  it('grants again to the same assistant once the previous delegation ended', async () => {
    const { application, delegationRepository } = await arrangeWithPractice();

    const ended = aDelegation()
      .identifiedBy('delegation-old')
      .onDesk('practice-7', 'person-grace')
      .givenTo('person-linus')
      .revokedAt(application.clock.now());

    await delegationRepository.save(ended.build());

    const id = await application.commandBus.execute(new GrantDelegationCommand(holder, desk, terms));

    expect((await delegationRepository.findById(id))?.isActive).toBe(true);
  });

  it.each([
    {
      what: 'on the desk of a member who is not a practitioner',
      onDesk: { ...desk, practitionerId: 'person-linus' },
      withTerms: terms,
      code: 'NOT_A_PRACTITIONER',
    },
    {
      what: 'to a member who is not an assistant',
      onDesk: desk,
      withTerms: { ...terms, assistantId: 'person-ada' },
      code: 'NOT_AN_ASSISTANT',
    },
    {
      what: 'to someone who is not a member of the practice',
      onDesk: desk,
      withTerms: { ...terms, assistantId: 'stranger' },
      code: 'NOT_AN_ASSISTANT',
    },
    {
      what: 'in a practice that does not exist',
      onDesk: { ...desk, practiceId: 'practice-9' },
      withTerms: terms,
      code: 'PRACTICE_NOT_FOUND',
    },
    {
      what: 'with an end in the past',
      onDesk: desk,
      withTerms: { ...terms, endsAt: new Date('2000-01-01T00:00:00.000Z') },
      code: 'DELEGATION_ENDS_IN_THE_PAST',
    },
  ])('refuses a delegation $what, and saves and publishes nothing', async ({ onDesk, withTerms, code }) => {
    const { application, delegationRepository } = await arrangeWithPractice();
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new GrantDelegationCommand(holder, onDesk, withTerms)),
    ).rejects.toMatchObject({ code });

    expect(delegationRepository.all()).toEqual([]);
    expect(application.eventBus.published).toHaveLength(before);
  });

  it('refuses a second active delegation of the same practitioner to the same assistant', async () => {
    const { application, delegationRepository } = await arrangeWithPractice();

    await application.commandBus.execute(new GrantDelegationCommand(holder, desk, terms));

    await expect(application.commandBus.execute(new GrantDelegationCommand(holder, desk, terms))).rejects.toMatchObject(
      { code: 'DELEGATION_ALREADY_ACTIVE' },
    );

    expect(delegationRepository.all()).toHaveLength(1);
  });
});

async function arrangeWithPractice() {
  const arranged = arrange();

  const practice = aPractice()
    .identifiedBy('practice-7')
    .managedBy('person-ada')
    .withPractitioner('person-grace')
    .withAssistant('person-linus');

  await arranged.practiceRepository.save(practice.build());

  return arranged;
}

function arrange() {
  const practiceRepository = new FakePracticeRepository();
  const personRepository = new FakePersonRepository();
  const delegationRepository = new FakeDelegationRepository();
  const relationships = new FakeIdentityRelationships();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), holders],
    fakes: [
      fake(PracticeRepository, practiceRepository),
      fake(PersonRepository, personRepository),
      fake(DelegationRepository, delegationRepository),
      fake(IdentityRelationships, relationships),
    ],
    idPrefix: 'delegation',
  });

  return { application, practiceRepository, personRepository, delegationRepository, relationships };
}
