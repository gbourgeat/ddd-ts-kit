import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { parserOf } from '../../src/support/parse/parser-of';

describe('parserOf', () => {
  it('keeps the parser the run configured', () => {
    const configured = { parse: () => ({}) };

    expect(parserOf({ languageOptions: { parser: configured } })).toBe(configured);
  });

  it('falls back to the parser of typescript-eslint when the linter hands none over', () => {
    expect(parserOf({ languageOptions: {} })).toBe(tseslint.parser);
  });

  it('falls back to it when the linter hands only the stand-in of Oxlint, whose parse throws', () => {
    const standIn = {
      name: 'oxlint',
      parse: () => {
        throw new Error('`context.languageOptions.parser.parse` not implemented yet.');
      },
    };

    expect(parserOf({ languageOptions: { parser: standIn } })).toBe(tseslint.parser);
  });
});
