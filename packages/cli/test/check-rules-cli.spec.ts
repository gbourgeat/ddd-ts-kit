import { describe, expect, it } from 'vitest';
import { CLEAN_RULE_IDS } from '../src/check/catalogue/clean-rule-ids';
import { ESLINT_ONLY_RULES } from '../src/check/catalogue/eslint-only-rules';
import { KNOWN_RULE_IDS } from '../src/check/catalogue/known-rule-ids';
import { changeConfig, checkJsonOf, errorFixOf, isRecord } from './check-support';
import { cli, scaffoldEverything, tempDir, write, type CliResult } from './helpers';

interface Listed {
  readonly id: string;
  readonly severity: string;
  readonly description: string;
}

describe('rules and explain', () => {
  it('lists every rule with its description and current severity', () => {
    const root = tempDir('rules');

    cli(root, 'init');
    changeConfig(root, { rules: { 'naming/suffix': 'warn', 'tree/closed': 'off' } });

    const rules = listedBy(cli(root, 'rules', '--json'));
    const delegated = rules.filter((rule) => rule.description.includes('checked by @ddd-ts-kit/eslint-plugin'));

    expect(rules.map((rule) => rule.id)).toEqual(KNOWN_RULE_IDS);
    expect(delegated.map((rule) => rule.id)).toEqual(ESLINT_ONLY_RULES.map((rule) => rule.id));

    expect(Object.fromEntries(rules.map((rule) => [rule.id, rule.severity]))).toMatchObject({
      'naming/suffix': 'warn',
      'tree/closed': 'off',
      'layer/domain-purity': 'error',
      'test/no-mocks': 'warn',
      'clean/function-size': 'warn',
      'clean/one-export-per-file': 'error',
      'ports/abstract-class': 'error',
      'scheduling/job-name': 'error',
    });

    expect(cli(root, 'rules').stdout).toMatch(/naming\/suffix\s+warn\s+A file in a role directory/);
  });

  it('works without a project', () => {
    expect(cli(tempDir('none'), 'rules').code).toBe(0);
  });

  it('explains every rule it knows, the ones another tool decides included, with its reason and both examples', () => {
    const root = tempDir('explain');

    for (const id of KNOWN_RULE_IDS) {
      const { stdout, code } = cli(root, 'explain', id);

      expect(code, id).toBe(0);
      expect(stdout, id).toContain('Why: ');
      expect(stdout, id).toContain('Bad:');
      expect(stdout, id).toContain('Good:');
    }

    expect(cli(root, 'explain', 'ports/abstract-class', '--json').json()).toMatchObject({
      id: 'ports/abstract-class',
      why: expect.any(String),
      bad: expect.any(String),
      good: expect.any(String),
    });

    expect(cli(root, 'explain', 'clean/blank-lines').stdout).toContain('approximation');
    expect(cli(root, 'explain', 'layer/nope').code).toBe(2);
  });

  it('says that the formatter is the authority for the layout of a file', () => {
    const root = tempDir('explain');
    const refused = cli(root, 'check', '--rule', 'clean/formatted', '--json');

    expect(cli(root, 'explain', 'clean/formatted').stdout).toContain(
      'checked by Biome with the `biome.json` of the project',
    );

    expect(cli(root, 'explain', 'clean/formatted', '--json').json()).toMatchObject({ checkedBy: '@biomejs/biome' });
    expect(cli(root, 'rules').stdout).toMatch(/clean\/formatted .*width of 120.*\(checked by Biome\)/);
    expect(refused.code).toBe(2);
    expect(errorFixOf(refused)).toContain('npm run format:check');
  });

  it('says that ESLint is the authority for the rules that need a syntax tree', () => {
    const root = tempDir('explain');
    const refused = cli(root, 'check', '--rule', 'domain/no-generic-error', '--json');

    expect(cli(root, 'explain', 'domain/aggregate-encapsulation').stdout).toContain(
      'checked by @ddd-ts-kit/eslint-plugin as `ddd-ts-kit/domain-aggregate-encapsulation`',
    );

    expect(cli(root, 'explain', 'application/handler-shape', '--json').json()).toMatchObject({
      checkedBy: '@ddd-ts-kit/eslint-plugin',
    });

    expect(cli(root, 'explain', 'domain/no-generic-error', '--json').json()).toMatchObject({
      id: 'domain/no-generic-error',
      checkedBy: '@ddd-ts-kit/eslint-plugin',
      why: expect.stringContaining('a stable code'),
      bad: expect.stringContaining("throw new Error('Invoice already issued');"),
      good: expect.stringContaining('throw InvoiceAlreadyIssued.forInvoice(this.id);'),
    });

    expect(refused.code).toBe(2);
    expect(errorFixOf(refused)).toContain('npm run lint');
  });
});

describe('check --clean-only', () => {
  const found = (result: CliResult): string[] =>
    checkJsonOf(result).violations.map((violation) => `${violation.file} ${violation.ruleId}`);

  it('runs the rules that need no project on any directories', () => {
    const root = tempDir('clean');

    write(
      root,
      'lib/a.ts',
      'function helper(): number {\n  return 1;\n}\n\nexport function main(): number {\n  return helper();\n}\n',
    );

    write(root, 'lib/b.ts', '// const old = 1;\nexport const value: any = 1;\n');
    write(root, 'other/c.ts', 'export const fine = 1;\n');

    const result = cli(root, 'check', '--clean-only', 'lib', 'other', '--json');

    expect(result.code).toBe(1);
    expect(checkJsonOf(result).files).toBe(3);

    expect(found(result)).toEqual([
      'lib/a.ts clean/stepdown',
      'lib/b.ts clean/no-commented-out-code',
      'lib/b.ts clean/no-escape-hatch',
    ]);

    expect(checkJsonOf(cli(root, 'check', '--clean-only', 'lib', '--rule', 'clean/stepdown', '--json')).errors).toBe(1);
    expect(cli(root, 'check', '--clean-only', 'other').code).toBe(0);
  });

  it('holds the layout, the private members, the exports and the sizes of a file alone', () => {
    const root = tempDir('clean-layout');
    const long = `export function longest(): number {\n${Array.from({ length: 101 }, (_, index) => `  const step${index} = ${index};`).join('\n')}\n\n  return step0;\n}\n`;

    write(
      root,
      'src/first.ts',
      'export class First {\n  #count = 0;\n\n  next(): number {\n    this.#count += 1;\n    return this.#count;\n  }\n}\n\nexport class Second {}\n',
    );

    write(root, 'src/longest.ts', long);

    write(
      root,
      'src/list.ts',
      `export const list = [\n${Array.from({ length: 350 }, (_, index) => `  ${index},`).join('\n')}\n];\n`,
    );

    write(root, 'test/first.spec.ts', 'export class Probe {}\n\nexport class Other {}\n');

    const result = cli(root, 'check', '--clean-only', 'src', 'test', '--json');

    expect(found(result)).toEqual([
      'src/first.ts clean/no-hash-private',
      'src/first.ts clean/blank-lines',
      'src/first.ts clean/one-export-per-file',
      'src/list.ts clean/file-size',
      'src/longest.ts clean/function-size',
    ]);

    expect(checkJsonOf(result).violations.at(-1)).toMatchObject({
      severity: 'error',
      message: 'longest is 102 lines long: no function is longer than 100 lines.',
    });

    expect(CLEAN_RULE_IDS).toEqual(
      expect.arrayContaining([
        'clean/no-hash-private',
        'clean/blank-lines',
        'clean/one-export-per-file',
        'clean/file-size',
      ]),
    );
  });

  it('reads the limits of function size from the config, up to the ceiling', () => {
    const root = tempDir('limits');

    scaffoldEverything(root);
    changeConfig(root, { limits: { maxParameters: 1, maxFunctionLines: 3 } });

    const json = checkJsonOf(cli(root, 'check', '--rule', 'clean/function-size', '--json'));

    expect(json.errors).toBe(0);
    expect(json.warnings).toBeGreaterThan(5);
    expect(json.violations[0]?.message).toMatch(/\(limit [13]\)/);

    changeConfig(root, { limits: { maxFunctionLines: 500 } });

    expect(
      checkJsonOf(cli(root, 'check', '--rule', 'config/valid', '--json')).violations.map(
        (violation) => violation.message,
      ),
    ).toEqual(['"limits.maxFunctionLines" is 500, above the ceiling of 100: it is read as 100.']);
  });
});

function listedBy(result: CliResult): Listed[] {
  const parsed = result.json();
  const rules: unknown[] = Array.isArray(parsed) ? parsed : [];

  return rules.flatMap((rule) =>
    isRecord(rule)
      ? [{ id: String(rule['id']), severity: String(rule['severity']), description: String(rule['description']) }]
      : [],
  );
}
