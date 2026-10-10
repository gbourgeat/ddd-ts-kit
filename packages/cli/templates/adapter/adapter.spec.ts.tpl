import { describe, expect, it } from '{{tests.module}}';
{{#if adapter.decorated}}
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';
{{/if}}
import { Remote{{name.pascal}} } from '../../infrastructure/external/{{adapter.file}}.js';

describe('Remote{{name.pascal}}', () => {
{{#if adapter.decorated}}
  it('sends again a call the outside system failed, and answers once it succeeds', async () => {
    const fakes = createAspectFakes();
    let calls = 0;
    const adapter = new Remote{{name.pascal}}(async () => {
      calls += 1;
      if (calls === 1) throw new Error('unreachable');
      return 'answered';
    });

    const pending = withAspectRuntime(fakes, () => adapter.send({ operation: 'ping', payload: {} }));
    await new Promise((resolve) => setImmediate(resolve));
    fakes.scheduler.advance(30_000);

    expect(await pending).toBe('answered');
    expect(calls).toBe(2);
  });
{{/if}}
{{#unless adapter.decorated}}
  it('is an adapter of the port, with a transport given by the composition root', () => {
    const adapter = new Remote{{name.pascal}}(async () => 'answered');

    expect(adapter.transport).toBeDefined();
  });
{{/unless}}

  // TODO(domain): replace each entry below by a behaviour of {{name.pascal}} against the real outside system or its sandbox; hold this adapter and the fake of test/fakes to the same expectations.
  it.todo('answers what the outside system answers, in the types of {{context.kebab}}');
  it.todo('fails with a business error when the outside system refuses');
});
