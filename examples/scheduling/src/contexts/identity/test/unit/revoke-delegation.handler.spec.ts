import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { identityPermissions } from '@/contexts/identity/identity.permissions';
import { RevokeDelegationCommand } from '@/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { anIdentityWorld, type IdentityWorldOptions } from '@/contexts/identity/test/worlds/identity.world';

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
    const { application } = await arrange();

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
  return arrange(async (fakes) => {
    await fakes.delegationRepository.save(
      aDelegation().identifiedBy('delegation-1').onDesk('practice-7', 'person-grace').givenTo('person-linus').build(),
    );
  });
}

async function arrange(given: NonNullable<IdentityWorldOptions['given']> = async () => undefined) {
  const { identityRelationships: relationships, ...arranged } = await anIdentityWorld({
    modules: [holders],
    idPrefix: 'delegation',
    given,
  });

  return { ...arranged, relationships };
}
