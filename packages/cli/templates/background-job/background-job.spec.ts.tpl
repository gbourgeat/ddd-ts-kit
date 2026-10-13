import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{spec.diPlain}}
{{spec.contextImports}}
import type { Actor, Message } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{alias.platform}}/platform-test.module{{alias.ext}}';
{{job.permissionsImport}}
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';
import { {{name.pascal}}BackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}.background-job{{alias.ext}}';

const clerk: Actor = { id: 'clerk-1', type: 'user', roles: ['clerk'], attributes: {} };

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { clerk: [{{job.granted}}] } }),
});

describe('{{name.title}}, once enqueued', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { application, sent } = {{spec.await}}arrange();

    await application.as(clerk, () => application.jobQueue.enqueue({{name.pascal}}BackgroundJob, {}));

    expect(await application.backgroundJobs.runDue()).toMatchObject([{ job: '{{job.name}}', outcome: 'succeeded' }]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf({{job.command}}Command);
{{#if job.protected}}
    expect(sent[0]).toMatchObject({ actor: { id: 'clerk-1' } });
{{/if}}
  });

  // TODO(domain): replace each entry below by a test of what "{{name.words}}" asks of the use case: a run may be a retry, and a long one resumes from its checkpoint.
  it.todo('has the same outcome when the same job runs twice');
  it.todo('resumes from its checkpoint after an interrupted attempt');
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
