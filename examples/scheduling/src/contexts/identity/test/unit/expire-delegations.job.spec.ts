import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import type { Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { ExpireDelegationsCommand } from '@/contexts/identity/application/commands/expire-delegations/expire-delegations.command';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [identityPermissions['delegation.expire']] },
    systemRole: 'scheduler',
  }),
});

describe('Expire delegations, when its time comes', () => {
  it('sends expire delegations as the system actor of the job', async () => {
    const { application, sent } = arrange();

    await application.jobs.runNow('identity.expire-delegations');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(ExpireDelegationsCommand);
    expect(sent[0]).toMatchObject({ actor: { id: 'system:identity.expire-delegations', type: 'system' } });
  });

  it('runs once in each network, in that network', async () => {
    const { application, sent } = arrange(['north', 'south']);

    await application.jobs.runNow('identity.expire-delegations');

    expect(sent).toHaveLength(2);
  });

  it('names the instant the occurrence was planned for, never the instant it really runs', async () => {
    const { application, sent } = arrange();

    const run = await application.jobs.runNow('identity.expire-delegations');

    expect(sent[0]).toMatchObject({ at: run.scheduledAt });
  });

  it('has the same outcome when the same occurrence runs twice', async () => {
    const { application, delegationRepository } = arrangeWithDelegations();

    await delegationRepository.save(
      aDelegation()
        .identifiedBy('delegation-due')
        .bornAt(new Date('2020-01-01T00:00:00.000Z'))
        .endingAt(new Date('2020-02-01T00:00:00.000Z'))
        .build(),
    );

    await application.jobs.runNow('identity.expire-delegations');
    const announced = application.eventBus.published.length;

    await application.jobs.runNow('identity.expire-delegations');

    expect((await delegationRepository.findById('delegation-due'))?.isActive).toBe(false);
    expect(application.eventBus.published).toHaveLength(announced);
  });
});

function arrangeWithDelegations() {
  const delegationRepository = new FakeDelegationRepository();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), authorization],
    tenants: ['north'],
    fakes: [
      fake(DelegationRepository, delegationRepository),
      fake(IdentityRelationships, new FakeIdentityRelationships()),
    ],
  });

  return { application, delegationRepository };
}

function arrange(networks: readonly string[] = ['north']) {
  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), authorization],
    tenants: networks,
  });

  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
