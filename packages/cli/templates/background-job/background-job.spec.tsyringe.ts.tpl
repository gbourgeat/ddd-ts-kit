import { describe, expect, it } from '{{tests.module}}';
{{#unless job.protected}}
{{#unless world.through}}
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{/unless}}
import { anActor } from '@ddd-ts-kit/auth/testing';
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
import { earlierVersionOf } from '@ddd-ts-kit/testing';
{{#unless world.through}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{/unless}}
{{job.permissionsImport}}
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';
{{job.specImport}}
{{#if world.through}}
{{world.import}}
{{/if}}
{{#if job.protected}}

const { holder: enqueuer, authorizer } = holdersOf({{job.granted}});
const authorization = authorizationModule({ authorizer });
{{/if}}
{{#unless job.protected}}

const enqueuer = anActor().build();
{{#unless world.through}}
const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/unless}}
{{/unless}}

describe('{{name.title}}, once enqueued', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { application, sent } = {{world.await}}arrange();

{{#if job.hasPayload}}
    const payload: {{name.pascal}}Payload = {
{{job.payloadSample}}
    };

    await application.as(enqueuer, () => application.jobQueue.enqueue({{name.pascal}}BackgroundJob, payload));
{{/if}}
{{#unless job.hasPayload}}
    await application.as(enqueuer, () => application.jobQueue.enqueue({{name.pascal}}BackgroundJob, {}));
{{/unless}}

    expect(await application.backgroundJobs.runDue()).toMatchObject([{ job: '{{job.name}}', outcome: 'succeeded' }]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf({{job.command}}Command);
{{#if job.protected}}
    expect(sent[0]).toMatchObject({ actor: { id: enqueuer.id } });
{{/if}}
  });

  it('never runs a payload enqueued in an earlier shape: the job is dead with INVALID_JOB_PAYLOAD', async () => {
    const { application, sent } = {{world.await}}arrange();
    const earlierVersion = earlierVersionOf({{name.pascal}}BackgroundJob);

    await application.as(enqueuer, () => application.jobQueue.enqueue(earlierVersion, {{job.misfit}}));

    await expect(application.backgroundJobs.runDue()).rejects.toMatchObject({
      code: 'INVALID_JOB_PAYLOAD',
      job: '{{job.name}}',
    });

    expect(sent).toHaveLength(0);
    expect(application.backgroundJobs.store.list()).toMatchObject([{ status: 'dead', lastErrorCode: 'INVALID_JOB_PAYLOAD' }]);
  });

  // TODO(domain): replace each entry below by a test of what "{{name.words}}" asks of the use case: a run may be a retry, and a long one resumes from its checkpoint.
  it.todo('has the same outcome when the same job runs twice');
  it.todo('resumes from its checkpoint after an interrupted attempt');
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
  });
{{/unless}}

  const sent: Message[] = [];

  application.commandBus.use(async (message) => {
    sent.push(message);
  });

  return { application, sent };
}
