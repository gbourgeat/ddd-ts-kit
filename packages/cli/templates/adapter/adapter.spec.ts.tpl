import { describe, expect, it } from '{{tests.module}}';
{{#if adapter.decorated}}
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';
{{/if}}
import { Remote{{name.pascal}} } from '{{alias.context}}/infrastructure/external/{{adapter.file}}{{alias.ext}}';
{{#if adapter.decorated}}

class Flaky{{name.pascal}} extends Remote{{name.pascal}} {
  calls = 0;

  protected override async transport(): Promise<unknown> {
    this.calls += 1;

    if (this.calls === 1) {
      throw new Error('unreachable');
    }

    return 'answered';
  }
}
{{/if}}

class Unwired{{name.pascal}} extends Remote{{name.pascal}} {
  async sendUnwired(operation: string): Promise<unknown> {
    return this.transport({ operation, payload: {} });
  }
}

describe('The remote {{name.words}}', () => {
  {{#if adapter.decorated}}
  it('sends again a call the outside system failed, and answers once it succeeds', async () => {
    const fakes = createAspectFakes();
    const adapter = new Flaky{{name.pascal}}();
    const pending = withAspectRuntime(fakes, () => adapter.send({ operation: 'ping', payload: {} }));

    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);

    expect(await pending).toBe('answered');
    expect(adapter.calls).toBe(2);
  });
  {{/if}}
  it('refuses to send a call as long as its transport is not written, and names the operation', async () => {
    const adapter = new Unwired{{name.pascal}}();

    await expect(adapter.sendUnwired('ping')).rejects.toThrow('"ping" was not sent');
  });

  // TODO(domain): replace each entry below by a behaviour of {{name.pascal}} against the real outside system or its sandbox; hold this adapter and the fake of test/fakes to the same expectations.
  it.todo('answers what the outside system answers, in the types of {{context.kebab}}');
  it.todo('fails with a business error when the outside system refuses');
});
