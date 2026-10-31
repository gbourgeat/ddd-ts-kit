import { describe, expect, it } from '{{tests.module}}';
import { {{name.pascal}}Translator } from '{{alias.context}}/infrastructure/anti-corruption/{{name.kebab}}.translator{{alias.ext}}';

describe('Translating the model of {{name.title}}', () => {
  // TODO(domain): replace this test by the entries below once the fields of {{name.title}} are declared, each a test with a real sample received from {{name.title}}.
  it('answers an empty record of {{context.kebab}} as long as its mapping is not written', () => {
    expect(new {{name.pascal}}Translator().translate({})).toEqual({});
  });

  it.todo('maps every field to the vocabulary of {{context.kebab}}');
  it.todo('refuses a record the model of {{context.kebab}} cannot express');
});
