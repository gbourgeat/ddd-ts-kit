import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations.js';
import { platformTestModule } from '@/platform/platform-test.module.js';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions.js';
import { RevokeDelegationCommand } from '@/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command.js';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port.js';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository.js';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository.js';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository.js';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder.js';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake.js';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake.js';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake.js';
import { FakePracticeRepository } from '@/contexts/identity/test/fakes/practice.repository.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['delegation.revoke']] } }),
});

const holder = anActor().withRole('holder').build();

const desk = { practiceId: 'practice-7', practitionerId: 'person-grace' };

describe('Revoke delegation', () => {
  it('saves the delegation and answers its identifier', async () => {
    const { application, delegationRepository } = await arrangeWithDelegation();

    const id = await application.commandBus.execute(new RevokeDelegationCommand(holder, desk, 'delegation-1'));

    expect(id).toBe('delegation-1');
    expect(await delegationRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission delegation.revoke', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(new RevokeDelegationCommand(anActor().build(), desk, 'delegation-1')),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('ends the delegation, takes the desk back from the assistant, and tells the other contexts', async () => {
    const { application, delegationRepository, relationships } = await arrangeWithDelegation();
    const before = application.eventBus.published.length;

    await application.commandBus.execute(new RevokeDelegationCommand(holder, desk, 'delegation-1'));

    expect((await delegationRepository.findById('delegation-1'))?.isActive).toBe(false);
    expect(relationships.current).toEqual([]);

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.delegation.revoked',
        payload: {
          delegationId: 'delegation-1',
          practiceId: 'practice-7',
          practitionerId: 'person-grace',
          assistantId: 'person-linus',
          cause: 'revoked',
        },
      },
    ]);
  });

  it('refuses to revoke twice, and publishes nothing the second time', async () => {
    const { application } = await arrangeWithDelegation();

    await application.commandBus.execute(new RevokeDelegationCommand(holder, desk, 'delegation-1'));
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new RevokeDelegationCommand(holder, desk, 'delegation-1')),
    ).rejects.toMatchObject({
      code: 'DELEGATION_NOT_ACTIVE',
    });

    expect(application.eventBus.published).toHaveLength(before);
  });

  it.each([
    ['a delegation that does not exist', desk, 'delegation-9'],
    ['a delegation of the desk of another practitioner', { ...desk, practitionerId: 'person-other' }, 'delegation-1'],
    ['a delegation of another practice', { ...desk, practiceId: 'practice-8' }, 'delegation-1'],
  ])('does not find %s, and saves and publishes nothing', async (_what, onDesk, delegationId) => {
    const { application, delegationRepository } = await arrangeWithDelegation();
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new RevokeDelegationCommand(holder, onDesk, delegationId)),
    ).rejects.toMatchObject({
      code: 'DELEGATION_NOT_FOUND',
    });

    expect((await delegationRepository.findById('delegation-1'))?.isActive).toBe(true);
    expect(application.eventBus.published).toHaveLength(before);
  });
});

async function arrangeWithDelegation() {
  const arranged = arrange();

  await arranged.delegationRepository.save(
    aDelegation().identifiedBy('delegation-1').onDesk('practice-7', 'person-grace').givenTo('person-linus').build(),
  );

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
