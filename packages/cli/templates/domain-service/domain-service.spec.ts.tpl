import { describe, expect, it } from '{{tests.module}}';
import { {{name.pascal}}Service } from '{{alias.context}}/domain/services/{{name.kebab}}.service.js';

describe('{{name.pascal}}Service', () => {
  it('holds no state of its own', () => {
    expect(Object.keys(new {{name.pascal}}Service())).toEqual([]);
  });

  // TODO(domain): replace each entry below by a test named after the business decision {{name.pascal}}Service makes, given aggregates built with the builders of test/builders.
  it.todo('makes its decision from the aggregates it is given');
  it.todo('refuses the decision when a rule spanning several aggregates is violated');
});
