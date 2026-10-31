import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rules as ESLINT_RULES } from '../../eslint-plugin/src/rules/rules';
import { docsOf } from '../../eslint-plugin/src/support/rule/docs-of';
import { ROLES } from '../src/check/canonical/roles';
import { KNOWN_RULE_IDS } from '../src/check/catalogue/known-rule-ids';
import { CONTEXT_FILES } from '../src/context-files';
import { barrelFile, dependenciesFile } from '../src/declared';
import { controllersFile } from '../src/nest-controllers/controllers-file';
import { REPO_ROOT } from './helpers';

/**
 * docs/ARCHITECTURE.md is normative: what it says of a rule, of the canonical tree and of who
 * checks what is held to the checker and to the ESLint plugin, whose rules this spec reads from
 * their sources (rules.spec.ts holds section 3 to the ids of the checker).
 */
/** What a spec names a role that `test/spec-required` asks a spec for, by the suffix of its file. */
const SPEC_REQUIRED_ROLES: Readonly<Record<string, readonly string[]>> = {
  '.aggregate.ts': ['aggregate'],
  '.vo.ts': ['value object'],
  '.service.ts': ['domain service'],
  '.state-machine.ts': ['state machine'],
  '.handler.ts': ['command handler', 'query handler'],
  '.event-handler.ts': ['domain event handler'],
  '.job.ts': ['job'],
  '.process.ts': ['process manager'],
  '.background-job.ts': ['background job'],
  '.projection.ts': ['projection'],
  '.integration-handler.ts': ['integration event handler'],
};

const ESLINT_RULE_IDS = [...new Set(Object.values(ESLINT_RULES).map((rule) => docsOf(rule).ruleId))];

describe('docs/ARCHITECTURE.md against the checker', () => {
  it('names in the row of test/spec-required every role the checker asks a spec for', () => {
    const suffixes = [...new Set(ROLES.flatMap((role) => role.specFor ?? []))];
    const row = ruleRow('test/spec-required');

    expect(Object.keys(SPEC_REQUIRED_ROLES).sort()).toEqual(suffixes.sort());

    expect(
      Object.values(SPEC_REQUIRED_ROLES)
        .flat()
        .filter((role) => !row.includes(role)),
    ).toEqual([]);
  });

  it('lists in the canonical tree every file the checker accepts at the root of a context, and every suffix of a role', () => {
    const tree = canonicalTree();
    const context = '<context>';

    const rootFiles = [
      'CONTEXT.md',
      `${context}.module.ts`,
      barrelFile(context),
      dependenciesFile(context),
      controllersFile(context),
      ...CONTEXT_FILES.map((file) => file.root(context)),
    ];

    expect(rootFiles.filter((file) => !tree.includes(` ${file} `))).toEqual([]);
    expect(ROLES.flatMap((role) => role.suffixes).filter((suffix) => !tree.includes(suffix))).toEqual([]);
  });

  it('gives every rule of the kit a row of "Who checks what", by its id or its family', () => {
    const table = `${analyzerRow('ddd-ts-kit check')} ${analyzerRow('@ddd-ts-kit/eslint-plugin')} ${analyzerRow('Biome')}`;

    expect(KNOWN_RULE_IDS.filter((id) => !namedIn(table, id))).toEqual([]);
  });

  it('names in the row of the ESLint plugin every rule it holds, by its id or its family', () => {
    const row = analyzerRow('@ddd-ts-kit/eslint-plugin');

    expect(ESLINT_RULE_IDS.filter((id) => !namedIn(row, id))).toEqual([]);
  });

  it('names, where a row of "Who checks what" gives a whole family, each rule of it the analyzer does not hold', () => {
    const checkerAlone = analyzerRow('ddd-ts-kit check').split('It also holds')[0] ?? '';
    const eslintRow = analyzerRow('@ddd-ts-kit/eslint-plugin');

    expect(unsaidExceptions(checkerAlone, (id) => !ESLINT_RULE_IDS.includes(id))).toEqual([]);
    expect(unsaidExceptions(eslintRow, (id) => ESLINT_RULE_IDS.includes(id))).toEqual([]);
  });
});

function architecture(): string {
  return fs.readFileSync(path.join(REPO_ROOT, 'docs/ARCHITECTURE.md'), 'utf8');
}

function ruleRow(id: string): string {
  return architecture().match(new RegExp(`^\\| \`${id}\` \\|.*$`, 'm'))?.[0] ?? '';
}

function analyzerRow(analyzer: string): string {
  const section = architecture().split('### Who checks what')[1] ?? '';

  return (
    section.split('\n').find((line) => line.startsWith(`| \`${analyzer}\``) || line.startsWith(`| ${analyzer}`)) ?? ''
  );
}

function canonicalTree(): string {
  const section = architecture().split('## 2. Canonical tree')[1] ?? '';

  return section.split('```')[1] ?? '';
}

function namedIn(text: string, id: string): boolean {
  const family = id.split('/')[0] ?? id;

  return text.includes(`\`${id}\``) || text.includes(`\`${family}/*\``);
}

/** The ids of each family a text names whole (`authz/*`) that the analyzer does not hold and the text leaves unnamed. */
function unsaidExceptions(text: string, held: (id: string) => boolean): string[] {
  const families = [...text.matchAll(/`([a-z-]+)\/\*`/g)].map((match) => match[1]);

  return KNOWN_RULE_IDS.filter((id) => families.includes(id.split('/')[0]) && !held(id) && !text.includes(`\`${id}\``));
}
