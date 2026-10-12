import { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import plugin, { rules } from '../../src/index.js';
import { docsOf } from '../../src/support/rule/docs-of.js';
import { BOUNDARY_CASES, SPELLINGS, type BoundaryCase } from '../support/boundary-cases.js';
import { SAMPLE_CONFIG } from '../support/rule-tester.js';

const ALIAS_RULE = 'ddd-ts-kit/imports-alias-only';
const EXTENSION_RULE = 'ddd-ts-kit/imports-extension';
const IMPORT_RULES: readonly (string | null)[] = [ALIAS_RULE, EXTENSION_RULE];
const BOUNDARY = /^(?:layer|context|ports|tracing|aspects)\//;

/** Every rule of the plugin that judges where an import goes, and the rule that asks for the alias. */
const judged = Object.fromEntries(
  Object.entries(rules)
    .filter(([, rule]) => BOUNDARY.test(docsOf(rule).ruleId) || docsOf(rule).ruleId.startsWith('imports/'))
    .map(([name]) => [`ddd-ts-kit/${name}`, 'error' as const]),
);

interface Verdict {
  readonly ruleId: string | null;
  readonly messageId: string | undefined;
  readonly line: number;
}

describe.each(SPELLINGS)(
  'a boundary rule sees through the alias exactly as through a relative path ("importExtension": "%s")',
  (importExtension, spell) => {
    const verdicts = (entry: BoundaryCase, specifier: string): Verdict[] =>
      verdictsUnder(importExtension, entry, specifier);

    it.each(BOUNDARY_CASES.map((entry) => [entry.rule, entry.what, entry] as const))('%s: %s', (rule, _what, entry) => {
      const written = { relative: verdicts(entry, spell(entry.relative)), alias: verdicts(entry, spell(entry.alias)) };
      const eslintId = `ddd-ts-kit/${rule.replace('/', '-')}`;
      const other = importExtension === 'none' ? entry.alias : entry.alias.replace(/\.js$/, '');

      expect(written.relative.filter(({ ruleId }) => ruleId === ALIAS_RULE)).toHaveLength(3);
      expect(written.alias.filter(({ ruleId }) => IMPORT_RULES.includes(ruleId))).toEqual([]);
      expect(boundaries(written.alias)).toEqual(boundaries(written.relative));
      // The spelling the config does not write is refused, and judged by the boundary rules all the same.
      expect(verdicts(entry, other).filter(({ ruleId }) => ruleId === EXTENSION_RULE)).toHaveLength(3);
      expect(boundaries(verdicts(entry, other))).toEqual(boundaries(written.alias));

      if (rule === 'none') {
        expect(boundaries(written.alias)).toEqual([]);
      } else {
        expect(boundaries(written.alias).filter(({ ruleId }) => ruleId === eslintId)).toHaveLength(3);
      }
    });

    it('holds every boundary id of the architecture reference that reads a project import', () => {
      const covered = new Set(BOUNDARY_CASES.map(({ rule }) => rule));
      const reading = ['layer/', 'context/published', 'context/declared'];

      const expected = Object.values(rules)
        .map((rule) => docsOf(rule).ruleId)
        .filter((id) => reading.some((prefix) => id.startsWith(prefix)));

      expect(expected.filter((id) => !covered.has(id))).toEqual([]);
      expect(expected.length).toBeGreaterThanOrEqual(7);
    });
  },
);

/** The three ways a module names another one: a static import, a re-export and a dynamic import. */
function verdictsUnder(importExtension: string, { file }: BoundaryCase, specifier: string): Verdict[] {
  const code = [
    `import type { Named } from '${specifier}';`,
    `export type { Other } from '${specifier}';`,
    `export const later = (): Promise<unknown> => import('${specifier}');`,
    'export type Kept = Named;',
  ].join('\n');

  const found = new TSESLint.Linter({ configType: 'flat' }).verify(
    code,
    {
      files: ['**/*.ts'],
      plugins: { 'ddd-ts-kit': plugin },
      languageOptions: { parser: tseslint.parser },
      settings: { 'ddd-ts-kit': { config: { ...SAMPLE_CONFIG, importExtension }, filename: file } },
      rules: judged,
    },
    { filename: 'sample.ts' },
  );

  return found.map(({ ruleId, messageId, line }) => ({ ruleId, messageId, line }));
}

function boundaries(found: readonly Verdict[]): Verdict[] {
  return found.filter(({ ruleId }) => !IMPORT_RULES.includes(ruleId));
}
