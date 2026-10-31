import { describe, expect, it } from '{{tests.module}}';
import type { BackgroundJob, Message } from '@ddd-ts-kit/kernel';
import { InMemoryJobStore, QueueWorker, StoredJobQueue } from '@ddd-ts-kit/scheduling';
{{#if world.through}}
import { earlierVersionOf } from '@ddd-ts-kit/testing';
{{/if}}
{{#unless world.through}}
import { createTestBuses, earlierVersionOf } from '@ddd-ts-kit/testing';
{{/unless}}
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';
{{job.specImport}}
{{#if world.through}}
{{world.import}}
{{/if}}

describe('{{name.title}}, once enqueued', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { jobQueue, worker, sent } = {{world.await}}arrange();

{{#if job.hasPayload}}
    const payload: {{name.pascal}}Payload = {
{{job.payloadSample}}
    };

    await jobQueue.enqueue({{name.pascal}}BackgroundJob, payload);
{{/if}}
{{#unless job.hasPayload}}
    await jobQueue.enqueue({{name.pascal}}BackgroundJob, {});
{{/unless}}

    expect(await worker.runDue()).toMatchObject([{ job: '{{job.name}}', outcome: 'succeeded' }]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf({{job.command}}Command);
{{#if job.protected}}
    expect(sent[0]).toMatchObject({ actor: { id: 'test-user' } });
{{/if}}
  });

  it('never runs a payload enqueued in an earlier shape: the job is dead with INVALID_JOB_PAYLOAD', async () => {
    const { jobQueue, worker, sent } = {{world.await}}arrange();
    const earlierVersion = earlierVersionOf({{name.pascal}}BackgroundJob);

    await jobQueue.enqueue(earlierVersion, {{job.misfit}});

    expect(await worker.runDue()).toMatchObject([{ job: '{{job.name}}', outcome: 'dead', errorCode: 'INVALID_JOB_PAYLOAD' }]);

    expect(sent).toHaveLength(0);
  });

  // TODO(domain): replace each entry below by a test of what "{{name.words}}" asks of the use case: a run may be a retry, and a long one resumes from its checkpoint.
  it.todo('has the same outcome when the same job runs twice');
  it.todo('resumes from its checkpoint after an interrupted attempt');
});

{{#unless world.through}}
{{world.comment}}
{{/unless}}
/** The queue and its worker in memory, on the clock and the execution scope of the test buses: the job is enqueued as `test-user`. */
{{world.async}}function arrange() {
{{#if world.through}}
  const { commandBus, clock, ids, executionScope } = await {{world.builder}}();
{{/if}}
{{#unless world.through}}
  const { commandBus, clock, ids, executionScope } = createTestBuses();
{{/unless}}
  const store = new InMemoryJobStore();
  const jobQueue = new StoredJobQueue({ store, clock, ids, scope: executionScope });
  const worker = new QueueWorker({ store, clock, scope: executionScope });
  const job: BackgroundJob<unknown> = new {{name.pascal}}BackgroundJob(commandBus);
  const sent: Message[] = [];

  worker.register({
    name: {{name.pascal}}BackgroundJob.jobName,
    payload: {{name.pascal}}BackgroundJob.payload,
    run: (payload, execution) => job.run(payload, execution),
  });

  commandBus.register({{job.command}}Command, {
    execute: () => Promise.reject(new Error('{{job.command}}Command is recorded before it reaches a handler')),
  });

  commandBus.use(async (message) => {
    sent.push(message);
  });

  return { jobQueue, worker, sent };
}
