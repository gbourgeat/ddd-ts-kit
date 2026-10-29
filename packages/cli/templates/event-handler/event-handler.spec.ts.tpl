import { describe, expect, it } from '{{tests.module}}';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { {{handler.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{handler.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

const fact = new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z'));

describe('When {{event.words}}', () => {
{{#unless handler.afterCommit}}
  it('carries out the policy that follows the fact', async () => {
{{/unless}}
{{#if handler.afterCommit}}
  it('carries out the effect that follows the commit of the fact', async () => {
{{/if}}
    const commands = new RecordingCommandBus();

    await new {{handler.pascal}}EventHandler(commands).handle(fact);

{{#unless handler.afterCommit}}
    // TODO(domain): name this test after the policy and assert the command it executes, `expect(commands.executed).toEqual([new ...Command(...)])`.
{{/unless}}
{{#if handler.afterCommit}}
    // TODO(domain): name this test after the effect and assert the command it executes, `expect(commands.executed).toEqual([new ...Command(...)])`; an effect through a port hands the handler the fake of the port and asserts what the fake kept.
{{/if}}
    expect(commands.executed).toEqual([]);
  });

  // TODO(domain): replace the entry below by a test of the same shape: the fact given, what the reaction sent asserted.
  it.todo('does nothing when the policy does not apply');
});
