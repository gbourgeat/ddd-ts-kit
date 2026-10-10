import { describe, expect, it } from '{{tests.module}}';
import { {{name.pascal}} } from '{{alias.context}}/domain/entities/{{name.kebab}}.entity.js';

describe('{{name.pascal}}', () => {
  it('is identified by its id, not by its attributes', () => {
    const first = {{name.pascal}}.create('{{name.kebab}}-1', {});
    const same = {{name.pascal}}.rehydrate('{{name.kebab}}-1', {});
    const other = {{name.pascal}}.create('{{name.kebab}}-2', {});

    expect(first.equals(same)).toBe(true);
    expect(first.equals(other)).toBe(false);
  });

  // TODO(domain): replace each entry below by a test named after the business rule it proves.
  it.todo('refuses to be created when one of its invariants is violated');
  it.todo('changes state through its business methods only');
});
