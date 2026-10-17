import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { ExpireDelegationsCommand } from '@/contexts/identity/application/commands/expire-delegations/expire-delegations.command';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { anIdentityWorld, type IdentityWorldOptions } from '@/contexts/identity/test/worlds/identity.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['delegation.expire']] } }),
});

const holder = anActor().withRole('holder').build();

const grantedAt = new Date('2026-03-01T00:00:00.000Z');
const end = new Date('2026-04-01T00:00:00.000Z');

describe('Expire delegations', () => {
  it('ends the delegations whose end is reached and leaves the others active', async () => {
    const { application, delegationRepository } = await arrangeWithDelegations();

    await application.commandBus.execute(new ExpireDelegationsCommand(holder, end));

    expect(delegationRepository.all().map((stored) => [stored.id, stored.isActive])).toEqual([
      ['delegation-due', false],
      ['delegation-later', true],
      ['delegation-open', true],
    ]);
  });

  it('is refused to an actor who does not hold the permission delegation.expire', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new ExpireDelegationsCommand(anActor().build(), end)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('announces each expiry at the instant asked for, takes the desk back, and tells the other contexts', async () => {
    const { application, relationships } = await arrangeWithDelegations();
    const before = application.eventBus.published.length;

    await application.commandBus.execute(new ExpireDelegationsCommand(holder, end));

    expect(relationships.current).not.toContain('delegate assistant-1 of practitioner-1 in practice-1');

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.delegation.revoked',
        occurredAt: end.toISOString(),
        payload: { delegationId: 'delegation-due', cause: 'expired' },
      },
    ]);
  });

  it('changes nothing when it is asked again for the same instant', async () => {
    const { application } = await arrangeWithDelegations();

    await application.commandBus.execute(new ExpireDelegationsCommand(holder, end));
    const before = application.eventBus.published.length;

    await application.commandBus.execute(new ExpireDelegationsCommand(holder, end));

    expect(application.eventBus.published).toHaveLength(before);
  });

  it('saves and publishes nothing when no delegation is due', async () => {
    const { application, delegationRepository } = await arrangeWithDelegations();
    const before = application.eventBus.published.length;

    await application.commandBus.execute(new ExpireDelegationsCommand(holder, new Date('2026-03-15T00:00:00.000Z')));

    expect(delegationRepository.all().every((stored) => stored.isActive)).toBe(true);
    expect(application.eventBus.published).toHaveLength(before);
  });
});

async function arrangeWithDelegations() {
  return arrange(async (fakes) => {
    const granted = aDelegation().bornAt(grantedAt);

    await fakes.delegationRepository.save(
      granted.identifiedBy('delegation-due').givenTo('assistant-1').endingAt(end).build(),
    );

    await fakes.delegationRepository.save(
      granted
        .identifiedBy('delegation-later')
        .givenTo('assistant-2')
        .endingAt(new Date('2026-05-01T00:00:00.000Z'))
        .build(),
    );

    await fakes.delegationRepository.save(granted.identifiedBy('delegation-open').givenTo('assistant-3').build());
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
