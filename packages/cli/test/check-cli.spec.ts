import { performance } from 'node:perf_hooks';
import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_ONLY_RULES, KNOWN_RULE_IDS, RULE_IDS } from '../src/check/rules/index.js';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers.js';

interface CheckJson {
  ok: boolean;
  errors: number;
  warnings: number;
  suppressions: number;
  suppressed: number;
  violations: { ruleId: string; severity: string; file: string; line: number; message: string; fix: string }[];
}

const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
const HANDLER = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';

describe('check', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('check');
    scaffoldEverything(root);
    write(root, AGGREGATE, `import { z } from 'zod';\n${read(root, AGGREGATE)}\nexport const shape = z;\n`);
    write(root, HANDLER, `import express from 'express';\n${read(root, HANDLER)}\nexport const app = express;\n`);
  });

  it('reports each violation with its rule, place and fix, and exits 1', () => {
    const result = cli(root, 'check');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(`${AGGREGATE}:1  error  layer/domain-purity`);
    expect(result.stdout).toContain('  fix: Remove the import');
    expect(result.stdout).toContain(`${HANDLER}:1  error  layer/application-inward`);
    expect(result.stdout).toMatch(/2 errors, 0 warnings, 0 suppressions in \d+ files\./);
  });

  it('prints machine-readable violations with --json or --format json', () => {
    const json = cli(root, 'check', '--json').json() as CheckJson;

    expect(json).toMatchObject({ ok: false, errors: 2, warnings: 0 });
    expect(json.violations.map((violation) => violation.ruleId)).toEqual(['layer/application-inward', 'layer/domain-purity']);
    for (const violation of json.violations) expect(violation.fix.length).toBeGreaterThan(20);
    expect(cli(root, 'check', '--format', 'json').json()).toEqual(json);
  });

  it('prints GitHub annotations with --format github', () => {
    const { stdout } = cli(root, 'check', '--format', 'github');

    expect(stdout).toContain(`::error file=${AGGREGATE},line=1,title=layer/domain-purity::The domain imports the package "zod".`);
    expect(stdout.split('\n').filter((line) => line.startsWith('::error file='))).toHaveLength(2);
  });

  it('limits the rules with --rule and the files with paths', () => {
    const byRule = cli(root, 'check', '--rule', 'layer/domain-purity', '--json').json() as CheckJson;
    const byPath = cli(root, 'check', 'src/contexts/billing/application', '--json').json() as CheckJson;
    const elsewhere = cli(root, 'check', 'src/contexts/shipping', '--json');

    expect(byRule.violations.map((violation) => violation.file)).toEqual([AGGREGATE]);
    expect(byPath.violations.map((violation) => violation.file)).toEqual([HANDLER]);
    expect(elsewhere.code).toBe(0);
  });

  it('refuses an unknown rule, an unknown format and a ref git cannot resolve', () => {
    expect(cli(root, 'check', '--rule', 'layer/unknown').code).toBe(2);
    expect(cli(root, 'check', '--format', 'xml').code).toBe(2);
    const noGit = cli(root, 'check', '--changed-since', 'main', '--json');
    expect(noGit.code).toBe(2);
    expect((noGit.json() as { error: { fix: string } }).error.fix).toContain('git repository');
  });

  it('applies the severities of the config: warn does not fail, off does not run', () => {
    const copy = tempDir('check-severity');
    scaffoldEverything(copy);
    write(copy, AGGREGATE, `import { z } from 'zod';\n${read(copy, AGGREGATE)}\nexport const shape = z;\n`);
    const setRule = (severity: string): void => {
      const config = JSON.parse(read(copy, 'ddd-ts-kit.config.json')) as { rules: Record<string, string>; deviations?: unknown };
      config.rules = { 'layer/domain-purity': severity };
      config.deviations = [{ what: 'rules.layer/domain-purity', adr: '0002', reason: 'The amount schema is shared with the route until it moves.' }];
      write(copy, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));
    };
    write(copy, 'docs/adr/0002-shared-amount-schema.md', '# The amount schema is shared with the route until it moves\n');

    setRule('warn');
    const warned = cli(copy, 'check', '--json');
    expect(warned.code).toBe(0);
    expect(warned.json()).toMatchObject({ ok: true, errors: 0, warnings: 1 });
    expect(cli(copy, 'check', '--format', 'github').stdout).toContain('::warning file=');

    setRule('off');
    expect(cli(copy, 'check', '--json').json()).toMatchObject({ errors: 0, warnings: 0 });
  });

  it('counts suppressions, honours them with a recorded reason and reports them without', () => {
    const copy = tempDir('check-suppress');
    scaffoldEverything(copy);
    const original = read(copy, AGGREGATE);
    const suppressed = (comment: string): string => `// ddd-ts-kit-disable-next-line ${comment}\nimport { z } from 'zod';\n${original}\nexport const shape = z;\n`;
    const ruleIds = (): string[] => (cli(copy, 'check', '--json').json() as CheckJson).violations.map((violation) => violation.ruleId);
    write(copy, 'docs/adr/0003-shared-amount-schema.md', '# The amount schema is shared with the route until it moves\n');

    write(copy, AGGREGATE, suppressed('layer/domain-purity -- ADR-0003: the amount schema is shared with the route until it moves'));
    const justified = cli(copy, 'check');
    expect(justified.code).toBe(0);
    expect(justified.stdout).toContain('0 errors, 0 warnings, 1 suppression in');
    expect(cli(copy, 'check', '--json').json()).toMatchObject({ suppressions: 1, suppressed: 1 });

    write(copy, AGGREGATE, suppressed('layer/domain-purity'));
    expect(ruleIds()).toEqual(['config/suppression-needs-reason', 'layer/domain-purity']);

    write(copy, AGGREGATE, suppressed('layer/domain-purity -- the amount schema is shared with the route until it moves'));
    expect(ruleIds()).toEqual(['governance/recorded-deviation']);

    write(copy, AGGREGATE, suppressed('layer/application-inward -- ADR-0003: wrong rule'));
    expect(ruleIds()).toEqual(['layer/domain-purity']);
  });

  it('finds the project root from a sub-directory', () => {
    expect(cli(`${root}/src/contexts/billing`, 'check', '--json').json()).toMatchObject({ errors: 2 });
  });

  it('fails with a fix when there is no config', () => {
    const result = cli(tempDir('empty'), 'check', '--json');

    expect(result.code).toBe(2);
    expect((result.json() as { error: { fix: string } }).error.fix).toContain('ddd-ts-kit init');
  });
});

describe('check --self', () => {
  it('replays the rule fixtures and exits 0', () => {
    const result = cli(tempDir('self'), 'check', '--self');

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/(\d+)\/\1 rule fixtures behave as expected\./);
    expect(result.stdout).not.toContain('FAIL');
  });
});

describe('check-file', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('check-file');
    scaffoldEverything(root);
  });

  it('runs the per-file rules on one file', () => {
    write(root, HANDLER, `import { InMemoryInvoiceRepository } from '../../../infrastructure/persistence/in-memory-invoice.repository.js';\n${read(root, HANDLER)}\nexport const repository = new InMemoryInvoiceRepository();\n`);

    const result = cli(root, 'check-file', HANDLER, '--json');
    const json = result.json() as CheckJson;

    expect(result.code).toBe(1);
    expect(json.violations.map((violation) => violation.ruleId).sort()).toEqual(['composition/only-in-module', 'layer/application-inward']);
    expect(json.violations.every((violation) => violation.file === HANDLER && violation.fix !== '')).toBe(true);
  });

  it('accepts an absolute path and stays silent on a clean file', () => {
    const result = cli(tempDir('elsewhere'), 'check-file', `${root}/${AGGREGATE}`);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('0 errors, 0 warnings, 0 suppressions in 1 file.');
  });

  it('does not run the rules that need the whole tree', () => {
    write(root, 'src/contexts/billing/domain/aggregates/issued-invoice.aggregate.ts', 'export class IssuedInvoice {}\n');

    expect(cli(root, 'check-file', 'src/contexts/billing/domain/aggregates/issued-invoice.aggregate.ts').code).toBe(0);
    expect((cli(root, 'check', '--rule', 'test/spec-required', '--json').json() as CheckJson).errors).toBe(1);
  });

  it('ignores files that are not sources of the project', () => {
    expect(cli(root, 'check-file', 'package.json').stdout).toBe('0 errors, 0 warnings, 0 suppressions in 0 files.');
    expect(cli(root, 'check-file', 'scripts/openapi.ts').code).toBe(0);
    expect(cli(root, 'check-file', 'src/missing.ts').code).toBe(0);
  });

  it('answers well under 200 ms', () => {
    const started = performance.now();
    for (let i = 0; i < 20; i += 1) cli(root, 'check-file', AGGREGATE);
    const average = (performance.now() - started) / 20;

    expect(average).toBeLessThan(50);
  });
});

describe('rules and explain', () => {
  it('lists every rule with its description and current severity', () => {
    const root = tempDir('rules');
    cli(root, 'init');
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { rules: Record<string, string> };
    config.rules = { 'naming/suffix': 'warn', 'tree/closed': 'off' };
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config));

    const rules = cli(root, 'rules', '--json').json() as { id: string; severity: string; description: string }[];

    expect(rules.map((rule) => rule.id)).toEqual(KNOWN_RULE_IDS);
    expect(rules.filter((rule) => rule.description.includes('checked by @ddd-ts-kit/eslint-plugin')).map((rule) => rule.id)).toEqual(ESLINT_ONLY_RULES.map((rule) => rule.id));
    expect(Object.fromEntries(rules.map((rule) => [rule.id, rule.severity]))).toMatchObject({
      'naming/suffix': 'warn',
      'tree/closed': 'off',
      'layer/domain-purity': 'error',
      'test/no-mocks': 'warn',
      'test/builder-required': 'warn',
    });
    expect(cli(root, 'rules').stdout).toMatch(/naming\/suffix\s+warn\s+A file in a role directory/);
  });

  it('works without a project', () => {
    expect(cli(tempDir('none'), 'rules').code).toBe(0);
  });

  it('explains a rule with its reason and both examples', () => {
    const root = tempDir('explain');

    for (const id of RULE_IDS) {
      const { stdout, code } = cli(root, 'explain', id);
      expect(code, id).toBe(0);
      expect(stdout, id).toContain('Why: ');
      expect(stdout, id).toContain('Bad:');
      expect(stdout, id).toContain('Good:');
    }
    expect(cli(root, 'explain', 'layer/domain-purity', '--json').json()).toMatchObject({ id: 'layer/domain-purity', why: expect.any(String), bad: expect.any(String), good: expect.any(String) });
    expect(cli(root, 'explain', 'layer/nope').code).toBe(2);
  });

  it('says that ESLint is the authority for the rules that need a syntax tree', () => {
    const root = tempDir('explain');

    expect(cli(root, 'explain', 'domain/aggregate-encapsulation').stdout).toContain('checked by @ddd-ts-kit/eslint-plugin as `ddd-ts-kit/domain-aggregate-encapsulation`');
    expect(cli(root, 'explain', 'application/handler-shape', '--json').json()).toMatchObject({ checkedBy: '@ddd-ts-kit/eslint-plugin' });
    const refused = cli(root, 'check', '--rule', 'domain/no-generic-error', '--json');
    expect(refused.code).toBe(2);
    expect((refused.json() as { error: { fix: string } }).error.fix).toContain('npm run lint');
  });
});

describe('check --clean-only', () => {
  it('runs the rules that need no project on any directories', () => {
    const root = tempDir('clean');
    write(root, 'lib/a.ts', 'function helper(): number {\n  return 1;\n}\n\nexport function main(): number {\n  return helper();\n}\n');
    write(root, 'lib/b.ts', '// const old = 1;\nexport const value: any = 1;\n');
    write(root, 'other/c.ts', 'export const fine = 1;\n');

    const result = cli(root, 'check', '--clean-only', 'lib', 'other', '--json');
    const json = result.json() as CheckJson & { files: number };

    expect(result.code).toBe(1);
    expect(json.files).toBe(3);
    expect(json.violations.map((violation) => `${violation.file} ${violation.ruleId}`)).toEqual([
      'lib/a.ts clean/stepdown',
      'lib/b.ts clean/no-commented-out-code',
      'lib/b.ts clean/no-escape-hatch',
    ]);
    expect((cli(root, 'check', '--clean-only', 'lib', '--rule', 'clean/stepdown', '--json').json() as CheckJson).errors).toBe(1);
    expect(cli(root, 'check', '--clean-only', 'other').code).toBe(0);
  });

  it('reads the limits of function size from the config', () => {
    const root = tempDir('limits');
    scaffoldEverything(root);
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { limits?: unknown };
    config.limits = { maxParameters: 1, maxFunctionLines: 3 };
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));

    const json = cli(root, 'check', '--rule', 'clean/function-size', '--json').json() as CheckJson;

    expect(json.errors).toBe(0);
    expect(json.warnings).toBeGreaterThan(5);
    expect(json.violations[0]?.message).toMatch(/\(limit [13]\)/);
  });
});
