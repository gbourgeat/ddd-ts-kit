import { describe, expect, it } from '{{tests.module}}';
import { unwrap } from '@ddd-ts-kit/kernel';
import { {{name.pascal}} } from '{{alias.context}}/domain/value-objects/{{name.kebab}}.vo.js';

describe('{{name.pascal}}', () => {
  it('is equal to another {{name.words}} with the same value', () => {
    const first = unwrap({{name.pascal}}.create('sample'));
    const second = unwrap({{name.pascal}}.create('sample'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = {{name.pascal}}.create('  ');

    expect(result.ok).toBe(false);
  });

  // TODO(domain): replace each entry below by a test named after the validity rule it proves, with real examples from the domain.
  it.todo('accepts every valid form of a {{name.words}}');
  it.todo('refuses each invalid form with its own error code');
  it.todo('normalizes equivalent inputs to the same value');
});
