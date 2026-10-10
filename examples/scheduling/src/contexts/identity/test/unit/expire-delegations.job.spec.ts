import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '../../identity.declarations.js';
import type { Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { identityPermissions } from '../../application/authorization/identity.permissions.js';
import { ExpireDelegationsCommand } from '../../application/commands/expire-delegations/expire-delegations.command.js';
import { IdentityRelationships } from '../../application/ports/identity-relationships.port.js';
import { DelegationRepository } from '../../domain/repositories/delegation.repository.js';
import { aDelegation } from '../builders/delegation.builder.js';
import { FakeDelegationRepository } from '../fakes/delegation.repository.fake.js';
import { FakeIdentityRelationships } from '../fakes/identity-relationships.fake.js';

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
    fakes: [
      fake(DelegationRepository, delegationRepository),
      fake(IdentityRelationships, new FakeIdentityRelationships()),
    ],
  });

  return { application, delegationRepository };
}

function arrange() {
  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), authorization],
  });

  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
