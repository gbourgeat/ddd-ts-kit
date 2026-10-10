import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{spec.diPlain}}
{{spec.contextImports}}
import type { Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform-test.module.js';
{{job.permissionsImport}}
import { {{job.command}}Command } from '../../application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command.js';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: [{{job.granted}}] },
    systemRole: 'scheduler',
  }),
});

describe('{{name.title}}, when its time comes', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { application, sent } = {{spec.await}}arrange();

    await application.jobs.runNow('{{job.name}}');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf({{job.command}}Command);
{{#if job.protected}}
    expect(sent[0]).toMatchObject({ actor: { id: 'system:{{job.name}}', type: 'system' } });
{{/if}}
  });

  // TODO(domain): replace each entry below by a test of what "{{name.words}}" asks of the use case: the period it names from `scheduledAt`, and that a second run of the same occurrence changes nothing.
  it.todo('names the period of the occurrence, never the instant it really runs');
  it.todo('has the same outcome when the same occurrence runs twice');
});

{{spec.async}}function arrange() {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  const application = createTestApplication({
    modules: [{{spec.modules}}],
  });

  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
