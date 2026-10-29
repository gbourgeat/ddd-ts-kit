import { describe, expect, it } from '{{tests.module}}';
{{#unless handler.afterCommit}}
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
{{/unless}}
import { {{handler.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{handler.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

const fact = new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z'));

describe('When {{event.words}}', () => {
{{#unless handler.afterCommit}}
  // TODO(domain): replace this test by the entries below once the policy is written: each named after the policy, of the same shape, the fact given and the command recorded asserted, `expect(commands.executed).toEqual([new ...Command(...)])`.
  it('handles the fact and sends no command until the policy is written', async () => {
    const commands = new RecordingCommandBus();

    await new {{handler.pascal}}EventHandler(commands).handle(fact);

    expect(commands.executed).toEqual([]);
  });

  it.todo('carries out the policy that follows the fact');
{{/unless}}
{{#if handler.afterCommit}}
  // TODO(domain): replace this test by the entries below once the effect is written: each named after the effect, the handler given the fake of its port and the fact, what the fake kept asserted.
  it('handles the fact and has no effect until the effect is written', async () => {
    await expect(new {{handler.pascal}}EventHandler().handle(fact)).resolves.toBeUndefined();
  });

  it.todo('carries out the effect that follows the commit of the fact');
{{/if}}
  it.todo('does nothing when the policy does not apply');
});
