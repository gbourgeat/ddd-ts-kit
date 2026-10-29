import { describe, expect, it } from '{{tests.module}}';
import { Simulated{{name.pascal}} } from '{{alias.context}}/infrastructure/external/simulated-{{name.kebab}}.adapter{{alias.ext}}';

describe('Simulated{{name.pascal}}', () => {
  it('is built with nothing from the environment: it reaches nothing outside the process', () => {
    expect(() => new Simulated{{name.pascal}}()).not.toThrow();
  });

  // TODO(domain): replace each entry below by a behaviour of {{name.pascal}}; hold this adapter, the remote one and the fake of test/fakes to the same expectations (a contract suite of the port, once two of them answer).
  it.todo('answers from the records it keeps, as the outside system would, in the types of {{context.kebab}}');
  it.todo('refuses what the outside system would refuse');
});
