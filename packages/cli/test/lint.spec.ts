import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';

interface Message {
  readonly ruleId: string | null;
  readonly severity: 1 | 2;
}

let root: string;

/**
 * ESLint as the project installs it, answering the messages and the rules meta the spec gives,
 * and keeping what it was asked: the third-party boundary of the command, like the stub of
 * drizzle-kit of the replay specs.
 */
function installEslint(messages: readonly Message[], meta: Readonly<Record<string, object>> = {}): void {
  write(root, 'node_modules/eslint/package.json', JSON.stringify({ name: 'eslint', type: 'module', main: 'index.js' }));
  write(root, 'answer.json', JSON.stringify({ messages, meta }));

  write(
    root,
    'node_modules/eslint/index.js',
    [
      "import fs from 'node:fs';",
      "const { messages, meta } = JSON.parse(fs.readFileSync('answer.json', 'utf8'));",
      'export class ESLint {',
      '  constructor(options) { this.options = options; }',
      '  static async outputFixes() {}',
      '  async lintFiles(patterns) {',
      "    fs.writeFileSync('asked.json', JSON.stringify({ patterns, fix: this.options.fix }));",
      "    return [{ filePath: 'src/a.ts', messages }];",
      '  }',
      '  getRulesMetaForResults() { return meta; }',
      '  async loadFormatter(name) {',
      "    fs.writeFileSync('formatter.txt', name);",
      '    return { format: (results) => `${name}: ${results[0].messages.length} problem(s)` };',
      '  }',
      '}',
      '',
    ].join('\n'),
  );
}

beforeEach(() => {
  root = initProject();
});

describe('ddd-ts-kit lint', () => {
  it('passes on no problem, and prints the report of ESLint in the format asked', () => {
    installEslint([]);

    const result = cli(root, 'lint', 'src', '--format', 'gitlab');

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('gitlab: 0 problem(s)');
    expect(read(root, 'formatter.txt')).toBe('gitlab');
    expect(JSON.parse(read(root, 'asked.json'))).toEqual({ patterns: ['src'], fix: false });
  });

  it('fails on a warning as on an error, and says how to settle it', () => {
    installEslint([{ ruleId: 'max-depth', severity: 1 }]);

    const result = cli(root, 'lint');

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('stylish: 1 problem(s)');
    expect(result.stderr).toContain('1 warning(s) fail the lint, as an error does');
    expect(JSON.parse(read(root, 'asked.json'))).toEqual({ patterns: ['.'], fix: false });
  });

  it('fails on an error, whatever the transitions', () => {
    installEslint([{ ruleId: 'ddd-ts-kit/clean-new', severity: 2 }], {
      'ddd-ts-kit/clean-new': { docs: { transition: '0.28.0' } },
    });

    const result = cli(root, 'lint', '--fix');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('1 error(s).');
    expect(JSON.parse(read(root, 'asked.json'))).toMatchObject({ fix: true });
  });

  it('shows the warnings of a rule of the kit in transition without failing on them, with the version that makes it an error', () => {
    installEslint(
      [
        { ruleId: 'ddd-ts-kit/clean-new', severity: 1 },
        { ruleId: 'ddd-ts-kit/clean-new', severity: 1 },
      ],
      { 'ddd-ts-kit/clean-new': { docs: { transition: '0.28.0' } }, 'max-depth': {} },
    );

    const result = cli(root, 'lint');

    expect(result.code).toBe(0);

    expect(result.stderr).toBe(
      'ddd-ts-kit/clean-new: 2 warning(s), not counted while the rule is new; it becomes an error in 0.28.0: fix them before upgrading to it.',
    );
  });

  it('refuses a project without ESLint, naming the install', () => {
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });

    const result = cli(root, 'lint');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('ESLint is not installed');
    expect(result.stderr).toContain('npm ci');
  });

  it('prints the failure of ESLint itself and exits 2', () => {
    installEslint([]);
    write(root, 'node_modules/eslint/index.js', "throw new Error('the config does not load');\n");

    const result = cli(root, 'lint');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('the config does not load');
  });
});
