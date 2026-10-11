import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { ExpireDelegationsCommand } from '@/contexts/identity/application/commands/expire-delegations/expire-delegations.command';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake';
import { FakePracticeRepository } from '@/contexts/identity/test/fakes/practice.repository.fake';

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
    const { application } = arrange();

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
  const arranged = arrange();
  const granted = aDelegation().bornAt(grantedAt);

  await arranged.delegationRepository.save(
    granted.identifiedBy('delegation-due').givenTo('assistant-1').endingAt(end).build(),
  );

  await arranged.delegationRepository.save(
    granted
      .identifiedBy('delegation-later')
      .givenTo('assistant-2')
      .endingAt(new Date('2026-05-01T00:00:00.000Z'))
      .build(),
  );

  await arranged.delegationRepository.save(granted.identifiedBy('delegation-open').givenTo('assistant-3').build());

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
