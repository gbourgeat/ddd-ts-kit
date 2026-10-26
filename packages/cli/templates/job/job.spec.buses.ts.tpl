import { describe, expect, it } from '{{tests.module}}';
import type { Message } from '@ddd-ts-kit/kernel';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{job.command}}Command } from '{{alias.context}}/application/commands/{{job.commandKebab}}/{{job.commandKebab}}.command{{alias.ext}}';
import { {{name.pascal}}Job } from '{{alias.context}}/application/scheduling/{{name.kebab}}.job{{alias.ext}}';

const occurrence = {
  scheduledAt: new Date('2026-01-01T07:00:00.000Z'),
  startedAt: new Date('2026-01-01T07:00:02.000Z'),
  attempt: 1,
  signal: new AbortController().signal,
{{#if job.perTenant}}
  tenantId: 'tenant-a',
{{/if}}
};

describe('{{name.title}}, when its time comes', () => {
  it('sends {{job.commandWords}}{{job.asActor}}', async () => {
    const { job, sent } = arrange();

    await job.run(occurrence);

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

function arrange() {
  const { commandBus } = createTestBuses();
  const sent: Message[] = [];

  commandBus.register({{job.command}}Command, {
    execute: () => Promise.reject(new Error('{{job.command}}Command is recorded before it reaches a handler')),
  });

  commandBus.use(async (message) => {
    sent.push(message);
  });

  return { job: new {{name.pascal}}Job(commandBus), sent };
}
