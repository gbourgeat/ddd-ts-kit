import { describe, expect, it } from '{{tests.module}}';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
{{#if upstream.known}}
import { {{upstream.definition}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language{{alias.index}}';
{{/if}}
import { {{name.pascal}}IntegrationHandler } from '{{alias.context}}/application/integration/handlers/{{name.kebab}}.integration-handler{{alias.ext}}';

const meta = { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' };
{{#if upstream.known}}
// TODO(domain): give the payload every field {{upstream.kebab}} declares.
const fact = {{upstream.definition}}.create({ {{upstream.payloadKey}}: '{{upstream.payloadSample}}' }, meta);
{{/if}}
{{#unless upstream.known}}
// TODO(domain): give the payload what {{upstream.kebab}} really sends.
const fact = { ...meta, type: '{{upstream.eventName}}', version: {{upstream.version}}, payload: {} };
{{/unless}}

describe('When {{upstream.kebab}} publishes {{upstream.eventName}}', () => {
  it('listens to the type {{upstream.kebab}} publishes, as a system actor named after its consumer name', () => {
    const handler = new {{name.pascal}}IntegrationHandler(new RecordingCommandBus());

    expect({{name.pascal}}IntegrationHandler.eventType).toBe('{{upstream.eventName}}');
    expect(handler.actor).toMatchObject({ id: 'system:{{context.kebab}}.{{name.kebab}}', type: 'system' });
  });

  it('executes the command that follows the upstream fact', async () => {
    const commands = new RecordingCommandBus();
    const handler = new {{name.pascal}}IntegrationHandler(commands);

    await handler.handle(fact);

    // TODO(domain): name this test after what {{context.kebab}} does and assert the command the handler executes, built with its actor, `expect(commands.executed).toEqual([new ...Command(handler.actor, ...)])`.
    expect(commands.executed).toEqual([]);
  });

  // TODO(domain): replace the entry below by a test of the same shape: the fact given, the command recorded asserted.
  it.todo('executes a command that is safe to repeat when the same event is delivered twice');
});
