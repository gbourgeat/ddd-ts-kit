import { describe, expect, it } from '{{tests.module}}';
{{#unless world.through}}
{{#unless job.protected}}
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{/unless}}
{{/unless}}
{{#if job.protected}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { holdersOf } from '@ddd-ts-kit/auth/testing';
{{/if}}
{{#unless world.through}}
{{spec.diPlain}}
{{spec.contextImports}}
{{/unless}}
import type { Message } from '@ddd-ts-kit/kernel';
{{#unless world.through}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{/unless}}
{{job.permissionsImport}}
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';
{{#if world.through}}
{{world.import}}
{{/if}}
{{#if job.protected}}

const { authorizer } = holdersOf({{job.granted}});
const authorization = authorizationModule({ authorizer });
{{/if}}
{{#unless world.through}}
{{#unless job.protected}}

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/unless}}
{{/unless}}

describe('{{name.title}}, when its time comes', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { application, sent } = {{world.await}}arrange();

    await application.jobs.runNow('{{job.name}}');

{{#if job.perTenant}}
    expect(sent).toHaveLength(2);
{{/if}}
{{#unless job.perTenant}}
    expect(sent).toHaveLength(1);
{{/unless}}
    expect(sent[0]).toBeInstanceOf({{job.command}}Command);
{{#if job.protected}}
    expect(sent[0]).toMatchObject({ actor: { id: 'system:{{job.name}}', type: 'system' } });
{{/if}}
  });
{{#if job.perTenant}}

  it('runs once for each tenant, in the scope of that tenant', async () => {
    const { application, tenants } = {{world.await}}arrange();

    await application.jobs.runNow('{{job.name}}');

    expect(tenants).toEqual(['tenant-a', 'tenant-b']);
  });
{{/if}}

  // TODO(domain): replace each entry below by a test of what "{{name.words}}" asks of the use case: the period it names from `scheduledAt`, and that a second run of the same occurrence changes nothing.
  it.todo('names the period of the occurrence, never the instant it really runs');
  it.todo('has the same outcome when the same occurrence runs twice');
{{#if job.perTenant}}
  // TODO(domain): once the handler reads a tenant-scoped repository, prove on the test database that each run reads its own tenant only: save a row for each tenant, run the job, and read both through the real repository inside the run (docs/concepts/scheduled-jobs.md, "A run reads its own tenant").
  it.todo('reads and writes one tenant at a time');
{{/if}}
});

{{#unless world.through}}
{{world.comment}}
{{/unless}}
{{world.async}}function arrange() {
{{#if world.through}}
  const { application } = await {{world.builder}}({{world.options}});
{{/if}}
{{#unless world.through}}
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  const application = createTestApplication({
    modules: [{{spec.modules}}],
{{#if job.perTenant}}
    tenants: ['tenant-a', 'tenant-b'],
{{/if}}
  });
{{/unless}}

  const sent: Message[] = [];
{{#if job.perTenant}}
  const tenants: (string | undefined)[] = [];
{{/if}}

  application.commandBus.use(async (message) => {
    sent.push(message);
{{#if job.perTenant}}
    tenants.push(application.executionScope.require().tenantId);
{{/if}}
  });

  return { application, sent{{#if job.perTenant}}, tenants{{/if}} };
}
