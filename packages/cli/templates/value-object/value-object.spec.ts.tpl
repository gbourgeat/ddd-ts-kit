import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
{{#if valueObjects.result}}
import { unwrap } from '@ddd-ts-kit/kernel';
{{/if}}
import { {{name.pascal}} } from '{{alias.context}}/domain/value-objects/{{name.kebab}}.vo{{alias.ext}}';

describe('{{name.title}}', () => {
  it('is equal to another {{name.words}} with the same value', () => {
{{#if valueObjects.throwing}}
    const first = {{name.pascal}}.create('sample');
    const second = {{name.pascal}}.create('sample');
{{/if}}
{{#if valueObjects.result}}
    const first = unwrap({{name.pascal}}.create('sample'));
    const second = unwrap({{name.pascal}}.create('sample'));
{{/if}}

    expect(first.equals(second)).toBe(true);
    expect(first.value).toBe('sample');
  });

  it('refuses an empty value with a coded error', () => {
{{#if valueObjects.throwing}}
    expectRefusal(() => {{name.pascal}}.create('  '), 'INVARIANT_VIOLATION');
{{/if}}
{{#if valueObjects.result}}
    expectRefusal({{name.pascal}}.create('  '), 'INVARIANT_VIOLATION');
{{/if}}
  });

  // TODO(domain): replace each entry below by a test named after the validity rule it proves, with real examples from the domain.
  it.todo('accepts every valid form of {{name.article}} {{name.words}}');
  it.todo('refuses each invalid form with its own error code');
  it.todo('normalizes equivalent inputs to the same value');
  it.todo('keeps its invariants for any value a generator can produce, as a property');
});
