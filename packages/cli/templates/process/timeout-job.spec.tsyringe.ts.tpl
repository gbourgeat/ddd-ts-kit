import { describe, expect, it } from '{{tests.module}}';
{{#unless world.through}}
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{spec.diPlain}}
{{spec.contextImports}}
{{/unless}}
import { ProcessRunner } from '@ddd-ts-kit/kernel';
{{#unless world.through}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{/unless}}
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';
{{#if world.through}}
{{world.import}}
{{/if}}

const HOUR = 3_600_000;
{{#unless world.through}}

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/unless}}

describe('The timeout of {{name.words}}, when its job runs', () => {
  it('runs the step of the deadline once it is due, and not before', async () => {
    const application = {{world.await}}arrange();
    const deadline = new Date(application.clock.now().getTime() + HOUR);
    const process = new {{name.pascal}}Process();
    const id = '{{name.kebab}}-1';

    await application.get(ProcessRunner).run({{name.pascal}}Process, id, (current) => process.started(id, deadline, current));

    expect(await application.backgroundJobs.runDue()).toEqual([]);

    application.clock.advance(HOUR);

    expect(await application.backgroundJobs.runDue()).toMatchObject([
      { job: '{{process.timeoutJob}}', outcome: 'succeeded' },
    ]);

    expect(application.processes.list()).toMatchObject([{ ended: true }]);
  });
});

{{#unless world.through}}
{{world.comment}}
{{/unless}}
{{world.async}}function arrange() {
{{#if world.through}}
  const { application } = await {{world.builder}}();

  return application;
{{/if}}
{{#unless world.through}}
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  return createTestApplication({
    modules: [{{spec.modules}}],
  });
{{/unless}}
}
