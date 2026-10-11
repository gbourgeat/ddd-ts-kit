import { describe, expect, it } from '{{tests.module}}';
import type { {{name.pascal}}Gateway } from '{{alias.context}}/application/ports/{{name.kebab}}-gateway.port{{alias.ext}}';
import { InProcess{{name.pascal}}Gateway } from '{{alias.context}}/infrastructure/external/in-process-{{name.kebab}}.gateway{{alias.ext}}';
import { Fake{{name.pascal}}Gateway } from '{{alias.context}}/test/fakes/{{name.kebab}}-gateway.fake{{alias.ext}}';

const ADAPTERS: readonly (readonly [string, () => {{name.pascal}}Gateway])[] = [
  ['the fake', () => new Fake{{name.pascal}}Gateway()],
  ['the in-process adapter', () => new InProcess{{name.pascal}}Gateway({})],
];

describe.each(ADAPTERS)('{{name.pascal}}Gateway, %s', (_name, create) => {
  it('is an adapter of the port', () => {
    expect(create()).toBeDefined();
  });

  // TODO(domain): replace each entry below by a behaviour every adapter of {{name.pascal}}Gateway must have, the remote one included: the same suite then holds them all.
  it.todo('answers what {{upstream.kebab}} publishes, in the types of {{context.kebab}}');
  it.todo('answers nothing, without failing, for an element {{upstream.kebab}} does not know');
});
