import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import * as analyticsDeclarations from '../../analytics.declarations.js';
import type { Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { analyticsPermissions } from '../../application/authorization/analytics.permissions.js';
import { VerifyOccupancyCommand } from '../../application/commands/verify-occupancy/verify-occupancy.command.js';

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { scheduler: [analyticsPermissions['occupancy.verify']] }, systemRole: 'scheduler' }) });

describe('Verify occupancy, when its time comes', () => {
  it('sends verify occupancy as the system actor of the job', async () => {
    const { application, sent } = arrange();

    await application.jobs.runNow('analytics.verify-occupancy');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(VerifyOccupancyCommand);
    expect(sent[0]).toMatchObject({ actor: { id: 'system:analytics.verify-occupancy', type: 'system' } });
  });

  it('names the night it was due, three in the morning in Paris, never the instant it really runs', async () => {
    const { application, sent } = arrange();

    await application.jobs.scheduler.start();
    await application.jobs.scheduler.advance(3 * 60 * 60 * 1000);

    expect(sent).toMatchObject([{ scheduledAt: new Date('2026-01-01T02:00:00.000Z') }]);
  });

  it('asks for the same days when the same occurrence runs twice', async () => {
    const { application, sent } = arrange();

    await application.jobs.runNow('analytics.verify-occupancy');
    await application.jobs.runNow('analytics.verify-occupancy');

    expect(sent).toMatchObject([{ scheduledAt: application.clock.now() }, { scheduledAt: application.clock.now() }]);
  });
});

function arrange() {
  const application = createTestApplication({ modules: [platformTestModule, contextModule('analytics', analyticsDeclarations), authorization] });
  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
