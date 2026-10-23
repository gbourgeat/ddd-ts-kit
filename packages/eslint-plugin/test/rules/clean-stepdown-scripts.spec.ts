import { type ESLint, Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import plugin from '../../src';

/** The linter as a project lints its scripts: the default parser of ESLint, whose scope manager is not the one of typescript-eslint. */
function findings(code: string): string[] {
  const linter = new Linter();

  const messages = linter.verify(
    code,
    {
      files: ['**/*.mjs'],
      // The rules of the plugin are typed for typescript-eslint; the linter of ESLint reads the same objects.
      plugins: { 'ddd-ts-kit': plugin as unknown as ESLint.Plugin },
      languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
      rules: { 'ddd-ts-kit/clean-stepdown': 'error' },
    },
    'scripts/build.mjs',
  );

  return messages.map((message) => message.message);
}

describe('clean-stepdown on a script parsed by the default parser of ESLint', () => {
  it('reports a helper declared above the function that first calls it, as it does on a TypeScript source', () => {
    const reported = findings(
      [
        'function directory() {',
        '  return 1;',
        '}',
        '',
        'export function project() {',
        '  return directory();',
        '}',
        '',
      ].join('\n'),
    );

    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('The function directory is declared above its first caller (line 6)');
  });

  it('reports nothing when the file reads from intention to detail', () => {
    expect(
      findings(
        [
          'export function project() {',
          '  return directory();',
          '}',
          '',
          'function directory() {',
          '  return 1;',
          '}',
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
});
