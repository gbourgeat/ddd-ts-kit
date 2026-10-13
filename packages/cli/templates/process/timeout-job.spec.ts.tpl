import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{spec.diPlain}}
{{spec.contextImports}}
import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{alias.platform}}/platform-test.module{{alias.ext}}';
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';

const HOUR = 3_600_000;

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });

describe('The timeout of {{name.words}}, when its job runs', () => {
  it('runs the step of the deadline once it is due, and not before', async () => {
    const application = {{spec.await}}arrange();
    const deadline = new Date(application.clock.now().getTime() + HOUR);

    await application
      .get(ProcessRunner)
      .run({{name.pascal}}Process, '{{name.kebab}}-1', (current) => new {{name.pascal}}Process().started('{{name.kebab}}-1', deadline, current));

    expect(await application.backgroundJobs.runDue()).toEqual([]);

    application.clock.advance(HOUR);

    expect(await application.backgroundJobs.runDue()).toMatchObject([
      { job: '{{process.timeoutJob}}', outcome: 'succeeded' },
    ]);

    expect(application.processes.list()).toMatchObject([{ ended: true }]);
  });
});

{{spec.async}}function arrange() {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  return createTestApplication({
    modules: [{{spec.modules}}],
  });
}
