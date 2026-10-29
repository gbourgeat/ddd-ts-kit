import { describe, expect, it } from '{{tests.module}}';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { {{name.pascal}}IntegrationHandler } from '{{alias.context}}/application/integration/handlers/{{name.kebab}}.integration-handler{{alias.ext}}';

describe('When {{upstream.kebab}} publishes {{upstream.eventName}}', () => {
  it('listens to the type {{upstream.kebab}} publishes, as a system actor named after its consumer name', () => {
    const handler = new {{name.pascal}}IntegrationHandler(new RecordingCommandBus());

    expect({{name.pascal}}IntegrationHandler.eventType).toBe('{{upstream.eventName}}');
    expect(handler.actor).toMatchObject({ id: 'system:{{context.kebab}}.{{name.kebab}}', type: 'system' });
  });

  {{#if upstream.known}}
  // TODO(domain): replace each entry below by a test named after what {{context.kebab}} does, of one shape: give `new {{name.pascal}}IntegrationHandler(commands)` a `RecordingCommandBus`, hand it the event as {{upstream.kebab}} publishes it (`{{upstream.definition}}.create({ ... }, { id, occurredAt })`, every field it declares) and assert the command built with `handler.actor`, `expect(commands.executed).toEqual([new ...Command(handler.actor, ...)])`.
  {{/if}}
  {{#unless upstream.known}}
  // TODO(domain): replace each entry below by a test named after what {{context.kebab}} does, of one shape: give `new {{name.pascal}}IntegrationHandler(commands)` a `RecordingCommandBus`, hand it the event {{upstream.kebab}} really sends (`{ id, occurredAt, type: '{{upstream.eventName}}', version: {{upstream.version}}, payload }`) and assert the command built with `handler.actor`, `expect(commands.executed).toEqual([new ...Command(handler.actor, ...)])`.
  {{/unless}}
  it.todo('executes the command that follows the upstream fact');
  it.todo('executes a command that is safe to repeat when the same event is delivered twice');
});
