import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { plugin } from '../src/plugin';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OXLINT = path.join(REPO_ROOT, 'node_modules/.bin/oxlint');
const BUILT_PLUGIN = path.join(REPO_ROOT, 'packages/eslint-plugin/dist/index.js');

const CONTEXT = 'src/contexts/billing';
const AGGREGATE = `${CONTEXT}/domain/aggregates/invoice.aggregate.ts`;

/**
 * The same sources, linted by ESLint (the plugin from source) and by Oxlint (the plugin as built, loaded as a JS plugin,
 * which hands the rules no type information and a parser that parses nothing): the rules of the kit have to say the
 * same thing under both, naming-business-name included, which once threw and stopped every rule of the file.
 */
const SOURCES: Readonly<Record<string, string>> = {
  [AGGREGATE]: [
    "import { Money } from '../value-objects/money';",
    '',
    '// const doubled = value * 2;',
    'export class Invoice {',
    '  #total = 0;',
    '',
    '  pay(): number {',
    '    const data = new Money(1);',
    '',
    '    return data.amount + this.#total;',
    '  }',
    '}',
    '',
  ].join('\n'),
  [`${CONTEXT}/domain/value-objects/money.ts`]: 'export class Money {\n  constructor(readonly amount: number) {}\n}\n',
};

const RULES = {
  'ddd-ts-kit/clean-no-commented-out-code': 'error',
  'ddd-ts-kit/clean-no-hash-private': 'error',
  'ddd-ts-kit/naming-business-name': 'error',
} as const;

const SETTINGS = {
  'ddd-ts-kit': {
    config: { contexts: { billing: { classification: 'core', upstreams: [] } } },
  },
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-oxlint-'));

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

/** Rule and line of each finding, sorted. */
function underEslint(file: string): string[] {
  const linter = new TSESLint.Linter({ configType: 'flat' });

  const messages = linter.verify(
    SOURCES[file] ?? '',
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { 'ddd-ts-kit': plugin },
        rules: RULES,
        settings: { 'ddd-ts-kit': { ...SETTINGS['ddd-ts-kit'], filename: file } },
      },
    ],
    file,
  );

  return messages.map(({ ruleId, line, message }) => `${ruleId ?? message} ${line}`).sort();
}

function underOxlint(file: string): string[] {
  write(
    '.oxlintrc.json',
    JSON.stringify({ jsPlugins: [{ name: 'ddd-ts-kit', specifier: BUILT_PLUGIN }], rules: RULES, settings: SETTINGS }),
  );

  const run = spawnSync(OXLINT, ['-c', '.oxlintrc.json', '-f', 'json', file], { cwd: root, encoding: 'utf8' });

  const report = JSON.parse(run.stdout.slice(run.stdout.indexOf('{'))) as {
    diagnostics: { code: string; labels: { span: { line: number } }[] }[];
  };

  return report.diagnostics
    .map(({ code, labels }) => {
      const [, , rule = ''] = /^(.+)\((.+)\)$/.exec(code) ?? [];

      return `ddd-ts-kit/${rule} ${labels[0]?.span.line}`;
    })
    .sort();
}

describe.skipIf(!fs.existsSync(BUILT_PLUGIN) || !fs.existsSync(OXLINT))('the rules of the kit under Oxlint', () => {
  for (const [file, content] of Object.entries(SOURCES)) {
    write(file, content);
  }

  it('reports what ESLint reports, whole file, with no type information and no parser of the linter', () => {
    const expected = underEslint(AGGREGATE);

    expect(expected).toEqual([
      'ddd-ts-kit/clean-no-commented-out-code 3',
      'ddd-ts-kit/clean-no-hash-private 5',
      'ddd-ts-kit/naming-business-name 8',
    ]);

    expect(underOxlint(AGGREGATE)).toEqual(expected);
  });
});
