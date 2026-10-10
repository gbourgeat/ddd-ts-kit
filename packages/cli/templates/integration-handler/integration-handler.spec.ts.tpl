import { describe, expect, it } from '{{tests.module}}';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}IntegrationHandler } from '../../application/integration/handlers/{{name.kebab}}.integration-handler.js';

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

  // TODO(domain): replace each entry below by a test that hands the handler an event built from the upstream declaration and asserts what {{context.kebab}} did, through a real command bus with the handler and its fakes.
  it.todo('executes the command that follows the upstream fact');
  it.todo('has the same outcome when the same event is delivered twice');
});
