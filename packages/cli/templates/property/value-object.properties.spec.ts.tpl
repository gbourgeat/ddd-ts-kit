import { describe, expect, it } from '{{tests.module}}';
import fc from 'fast-check';
{{#if valueObjects.result}}
import { unwrap } from '@ddd-ts-kit/kernel';
{{/if}}
import { {{name.pascal}} } from '{{alias.context}}/domain/value-objects/{{name.kebab}}.vo{{alias.ext}}';

describe('{{name.title}}, for any value', () => {
  it('is equal to the {{name.words}} created again from its own value', () => {
    fc.assert(
      fc.property(any{{name.pascal}}(), (value) => {
        expect(create(value.value).equals(value)).toBe(true);
      }),
    );
  });

  // TODO(domain): state each law {{name.pascal}} holds for every value as a property over any{{name.pascal}}(), its title the law, then remove the entry it replaces.
  it.todo('keeps its invariants after each of its operations, for any value');
  it.todo('gives the same answer whichever of two values comes first, for a comparison it offers');
  it.todo('gives the value back after a format then a parse, for any value');
});

// TODO(domain): generate the real components of {{name.pascal}}, within the bounds its factory accepts, so that every generated value is one the model accepts.
function any{{name.pascal}}(): fc.Arbitrary<{{name.pascal}}> {
  return fc
    .string({ minLength: 1 })
    .filter((value) => value.trim().length > 0)
    .map(create);
}

function create(value: string): {{name.pascal}} {
{{#if valueObjects.throwing}}
  return {{name.pascal}}.create(value);
{{/if}}
{{#if valueObjects.result}}
  return unwrap({{name.pascal}}.create(value));
{{/if}}
}
