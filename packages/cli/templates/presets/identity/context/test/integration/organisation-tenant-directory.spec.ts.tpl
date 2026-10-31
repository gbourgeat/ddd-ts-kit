import { afterAll, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
<<<<<<< HEAD
{{#if di.container}}
import { contextModule, kernelModule } from '@ddd-ts-kit/di';
import { createApplication } from '{{di.entry}}';
=======
{{#if di.tsyringe}}
import { contextModule, kernelModule } from '@ddd-ts-kit/di';
import { createApplication } from '@ddd-ts-kit/di/tsyringe';
>>>>>>> origin/main
{{/if}}
{{#if di.container}}
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  JobScheduler,
  type Actor,
  type JobExecution,
  type ScheduledJob,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless di.container}}
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if di.container}}
import { Scheduled } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { {{preset.adapter.pascal}}OrganisationRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-organisation.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}OrganisationTenantDirectory } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-organisation-tenant-directory.reader{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'tenant-directory-spec', actor, origin: 'test' }));

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

beforeEach(async () => {
  await database.reset();
});

afterAll(async () => {
  await database.close();
});

describe('{{preset.adapter.pascal}}OrganisationTenantDirectory', () => {
  it('lists no tenant while no organisation was opened', async () => {
    const { directory } = arrange();

    expect(await directory.tenants()).toEqual([]);
  });

  it('lists the organisations of the application as its tenants, by their id', async () => {
    const { organisations, directory } = arrange();

    await organisations.save(anOrganisation().identifiedBy('globex').build());
    await organisations.save(anOrganisation().identifiedBy('acme').build());

    expect(await directory.tenants()).toEqual(['acme', 'globex']);
  });

  it('lists an organisation opened after the first read, on the same directory', async () => {
    const { organisations, directory } = arrange();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    expect(await directory.tenants()).toEqual(['acme']);

    await organisations.save(anOrganisation().identifiedBy('globex').build());
    expect(await directory.tenants()).toEqual(['acme', 'globex']);
  });
{{#if di.container}}

  it('gives an organisation opened after the boot its run of a per-tenant job', async () => {
    const { organisations, directory } = arrange();
    const ran: (string | undefined)[] = [];

    class CloseTheDay implements ScheduledJob {
      async run(execution: JobExecution): Promise<void> {
        ran.push(execution.tenantId);
      }
    }

    Scheduled('tenant-directory-spec.close-the-day', { every: '1d', tenancy: 'per-tenant' }, [])(CloseTheDay);

    await organisations.save(anOrganisation().identifiedBy('acme').build());

    const application = createApplication({
      modules: [kernelModule({ tenants: directory }), contextModule('tenant-directory-spec', [CloseTheDay])],
    });

    await application.resolve(JobScheduler).runNow('tenant-directory-spec.close-the-day');
    expect(ran).toEqual(['acme']);

    await organisations.save(anOrganisation().identifiedBy('globex').build());
    ran.length = 0;

    await application.resolve(JobScheduler).runNow('tenant-directory-spec.close-the-day');
    expect(ran).toEqual(['acme', 'globex']);
  });
{{/if}}
});

function arrange() {
  const organisations = new {{preset.adapter.pascal}}OrganisationRepository(database.persistence.database, scope, clock);
  const directory = new {{preset.adapter.pascal}}OrganisationTenantDirectory(database.persistence.database);

  return { organisations, directory };
}
