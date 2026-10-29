import { describe, expect, it } from '{{tests.module}}';
import { {{name.pascal}}Service } from '{{alias.context}}/domain/services/{{name.kebab}}.service{{alias.ext}}';

describe('{{name.title}}', () => {
  it('is built with nothing: it decides from what it is given, with no port and no store', () => {
    expect(() => new {{name.pascal}}Service()).not.toThrow();
  });

  // TODO(domain): replace each entry below by a test named after the business decision {{name.pascal}}Service makes, given aggregates built with the builders of test/builders.
  it.todo('makes its decision from the aggregates it is given');
  it.todo('refuses the decision when a rule spanning several aggregates is violated');
});
