import { describe, expect, it } from '{{tests.module}}';
{{#if adapter.decorated}}
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';
{{/if}}
import { Remote{{name.pascal}} } from '../../infrastructure/external/{{adapter.file}}.js';
{{#if adapter.decorated}}

class Flaky{{name.pascal}} extends Remote{{name.pascal}} {
  calls = 0;

  protected override async transport(): Promise<unknown> {
    this.calls += 1;

    if (this.calls === 1) throw new Error('unreachable');

    return 'answered';
  }
}
{{/if}}

describe('Remote{{name.pascal}}', () => {
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
{{#unless adapter.decorated}}
  it('is an adapter of the port, built without argument until its transport is written', () => {
    expect(new Remote{{name.pascal}}()).toBeInstanceOf(Remote{{name.pascal}});
  });
{{/unless}}

  // TODO(domain): replace each entry below by a behaviour of {{name.pascal}} against the real outside system or its sandbox; hold this adapter and the fake of test/fakes to the same expectations.
  it.todo('answers what the outside system answers, in the types of {{context.kebab}}');
  it.todo('fails with a business error when the outside system refuses');
});
