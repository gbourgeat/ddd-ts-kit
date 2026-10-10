import { describe, expect, it } from 'vitest';
import { BOUNDARY_CASES, type BoundaryCase } from '../../eslint-plugin/test/support/boundary-cases.js';
import { RULES } from '../src/check/catalogue/rules.js';
import { runCheck } from '../src/check/engine/run-check.js';
import { loadProject } from '../src/check/project/load-project.js';
import { lines, projectWith } from './rules-support.js';

const ALIAS_RULE = 'imports/alias-only';
const BOUNDARY = /^(?:layer|context)\//;

const CONFIG = {
  contexts: {
    billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }] },
    catalog: { classification: 'supporting', upstreams: [] },
  },
};

interface Verdict {
  readonly ruleId: string;
  readonly line: number;
}

/** The table of the ESLint plugin, replayed on the checker: the two analyzers are held to the same imports. */
describe('a boundary rule of the checker sees through the alias exactly as through a relative path', () => {
  it.each(BOUNDARY_CASES.map((entry) => [entry.rule, entry.what, entry] as const))('%s: %s', (rule, _what, entry) => {
    const written = { relative: verdicts(entry, entry.relative), alias: verdicts(entry, entry.alias) };

    expect(written.relative.filter(({ ruleId }) => ruleId === ALIAS_RULE)).toHaveLength(3);
    expect(written.alias.filter(({ ruleId }) => ruleId === ALIAS_RULE)).toEqual([]);
    expect(boundaries(written.alias)).toEqual(boundaries(written.relative));

    if (rule === 'none') {
      expect(boundaries(written.alias)).toEqual([]);
    } else {
      expect(boundaries(written.alias).filter(({ ruleId }) => ruleId === rule)).toHaveLength(3);
    }
  });

  it('covers every rule of the checker that judges where an import of the project goes', () => {
    const covered = new Set(BOUNDARY_CASES.map(({ rule }) => rule));
    const reading = ['layer/', 'context/published', 'context/declared'];
    const expected = RULES.map(({ id }) => id).filter((id) => reading.some((prefix) => id.startsWith(prefix)));

    expect(expected.filter((id) => !covered.has(id))).toEqual([]);
    expect(expected).toHaveLength(7);
  });
});

/** The three ways a module names another one: a static import, a re-export and a dynamic import. */
function verdicts({ file }: BoundaryCase, specifier: string): Verdict[] {
  const root = projectWith(
    {
      [file]: lines(
        `import type { Named } from '${specifier}';`,
        `export type { Other } from '${specifier}';`,
        `export const later = (): Promise<unknown> => import('${specifier}');`,
        'export type Kept = Named;',
      ),
    },
    CONFIG,
  );

  const judged = RULES.map(({ id }) => id).filter((id) => BOUNDARY.test(id) || id === ALIAS_RULE);
  const { violations } = runCheck(loadProject(root), { rules: judged });

  return violations.filter((violation) => violation.file === file).map(({ ruleId, line }) => ({ ruleId, line }));
}

function boundaries(found: readonly Verdict[]): Verdict[] {
  return found.filter(({ ruleId }) => ruleId !== ALIAS_RULE);
}
