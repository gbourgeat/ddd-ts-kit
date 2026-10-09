import { describe, expect, it } from '{{tests.module}}';
import { {{name.pascal}}Translator } from '../../infrastructure/anti-corruption/{{name.kebab}}.translator.js';

describe('Translating the model of {{name.title}}', () => {
  it('produces a record of {{context.kebab}}', () => {
    expect(new {{name.pascal}}Translator().translate({})).toBeDefined();
  });

  // TODO(domain): replace each entry below by a test with a real sample received from {{name.title}}.
  it.todo('maps every field to the vocabulary of {{context.kebab}}');
  it.todo('refuses a record the model of {{context.kebab}} cannot express');
});
