import { describe, expect, it } from '{{tests.module}}';
import { Simulated{{name.pascal}} } from '{{alias.context}}/infrastructure/external/simulated-{{name.kebab}}.adapter{{alias.ext}}';

describe('Simulated{{name.pascal}}', () => {
  it('is an adapter of the port, built without argument: it reaches nothing outside the process', () => {
    expect(new Simulated{{name.pascal}}()).toBeInstanceOf(Simulated{{name.pascal}});
  });

  // TODO(domain): replace each entry below by a behaviour of {{name.pascal}}; hold this adapter, the remote one and the fake of test/fakes to the same expectations (a contract suite of the port, once two of them answer).
  it.todo('answers what the outside system would answer, in the types of {{context.kebab}}');
  it.todo('refuses what the outside system would refuse');
});
