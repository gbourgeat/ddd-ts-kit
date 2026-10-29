import { describe, expect, it } from '{{tests.module}}';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
{{#if upstream.known}}
import { {{upstream.definition}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language{{alias.index}}';
{{/if}}
import { {{name.pascal}}IntegrationHandler } from '{{alias.context}}/application/integration/handlers/{{name.kebab}}.integration-handler{{alias.ext}}';

const meta = { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' };

describe('When {{upstream.kebab}} publishes {{upstream.eventName}}', () => {
  it('listens to the type {{upstream.kebab}} publishes, as a system actor named after its consumer name', () => {
    const handler = new {{name.pascal}}IntegrationHandler(new RecordingCommandBus());

    expect({{name.pascal}}IntegrationHandler.eventType).toBe('{{upstream.eventName}}');
    expect(handler.actor).toMatchObject({ id: 'system:{{context.kebab}}.{{name.kebab}}', type: 'system' });
  });

  // TODO(domain): replace this test by the entries below once what {{context.kebab}} does is written: each named after it, of the same shape, the event given (every field {{upstream.kebab}} declares) and the command built with `handler.actor` asserted, `expect(commands.executed).toEqual([new ...Command(handler.actor, ...)])`.
  it('receives the event and sends no command until what {{context.kebab}} does is written', async () => {
    const commands = new RecordingCommandBus();
    {{#if upstream.known}}
    const event = {{upstream.definition}}.create({ {{upstream.payloadKey}}: '{{upstream.payloadSample}}' }, meta);
    {{/if}}
    {{#unless upstream.known}}
    const event = { ...meta, type: '{{upstream.eventName}}', version: {{upstream.version}}, payload: {} };
    {{/unless}}

    await new {{name.pascal}}IntegrationHandler(commands).handle(event);

    expect(commands.executed).toEqual([]);
  });

  it.todo('executes the command that follows the upstream fact');
  it.todo('executes a command that is safe to repeat when the same event is delivered twice');
});
