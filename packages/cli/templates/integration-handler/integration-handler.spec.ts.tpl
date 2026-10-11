import { describe, expect, it } from '{{tests.module}}';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
{{#if upstream.known}}
import { {{upstream.definition}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
{{/if}}
import { {{name.pascal}}IntegrationHandler } from '{{alias.context}}/application/integration/handlers/{{name.kebab}}.integration-handler{{alias.ext}}';

describe('When {{upstream.kebab}} publishes {{upstream.eventName}}', () => {
  it('listens to the type {{upstream.kebab}} publishes', () => {
    const handler = new {{name.pascal}}IntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf({{name.pascal}}IntegrationHandler);
    expect({{name.pascal}}IntegrationHandler.eventType).toBe('{{upstream.eventName}}');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new {{name.pascal}}IntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({ id: 'system:{{context.kebab}}.{{name.kebab}}', type: 'system' });
  });

  it('receives the event as {{upstream.kebab}} publishes it', async () => {
    const handler = new {{name.pascal}}IntegrationHandler(new InMemoryCommandBus());
    const meta = { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' };
    {{#if upstream.known}}
    // TODO(domain): give the payload every field {{upstream.kebab}} declares, register the command the handler executes and assert what {{context.kebab}} did.
    const event = {{upstream.definition}}.create({ {{upstream.payloadKey}}: '{{upstream.payloadSample}}' }, meta);
    {{/if}}
    {{#unless upstream.known}}
    // TODO(domain): give the payload what {{upstream.kebab}} really sends, register the command the handler executes and assert what {{context.kebab}} did.
    const event = { ...meta, type: '{{upstream.eventName}}', version: {{upstream.version}}, payload: {} };
    {{/unless}}

    await expect(handler.handle(event)).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test that hands the handler an event built from the upstream declaration and asserts what {{context.kebab}} did, through a real command bus with the handler and its fakes.
  it.todo('executes the command that follows the upstream fact');
  it.todo('has the same outcome when the same event is delivered twice');
});
