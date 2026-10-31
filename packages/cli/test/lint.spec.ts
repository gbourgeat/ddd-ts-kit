import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { initProject } from './support/init-project';

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
      '  constructor(options) { this.options = options; const { cache, cacheLocation, cacheStrategy } = options; fs.writeFileSync("cache.json", JSON.stringify({ cache, cacheLocation, cacheStrategy })); }',
      '  static async outputFixes() {}',
      '  async lintFiles(patterns) {',
      "    fs.writeFileSync('asked.json', JSON.stringify({ patterns, fix: this.options.fix }));",
      "    if (patterns.includes('nothere.ts')) throw Object.assign(new Error('No files matching'), { messageTemplate: 'file-not-found' });",
      "    return [{ filePath: 'src/a.ts', messages }];",
      '  }',
      '  getRulesMetaForResults() { return meta; }',
      '  async loadFormatter(name) {',
      "    fs.writeFileSync('formatter.txt', name);",
      "    if (name === 'nope') throw Object.assign(new Error('There was a problem loading formatter'), { code: 'ERR_MODULE_NOT_FOUND' });",
      '    return { format: (results) => name === "json" ? JSON.stringify(results) : `${name}: ${results[0].messages.length} problem(s)` };',
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

  it('names the rules in transition one after the other, by their id', () => {
    installEslint(
      [
        { ruleId: 'ddd-ts-kit/test-shape', severity: 1 },
        { ruleId: 'ddd-ts-kit/clean-new', severity: 1 },
      ],
      {
        'ddd-ts-kit/test-shape': { docs: { transition: '0.90.0' } },
        'ddd-ts-kit/clean-new': { docs: { transition: '0.28.0' } },
      },
    );

    const result = cli(root, 'lint');

    expect(result.code).toBe(0);

    expect(result.stderr.split('\n').map((line) => line.split(':')[0])).toEqual([
      'ddd-ts-kit/clean-new',
      'ddd-ts-kit/test-shape',
    ]);
  });

  it('keeps the cache of ESLint next to the project, keyed by content, and drops it when the lint changed', () => {
    installEslint([]);

    expect(cli(root, 'lint').code).toBe(0);

    expect(JSON.parse(read(root, 'cache.json'))).toEqual({
      cache: true,
      cacheLocation: `${path.join(root, '.eslintcache')}${path.sep}`,
      cacheStrategy: 'content',
    });

    const key = read(root, '.eslintcache/key');

    write(root, '.eslintcache/.cache_1', '{}');
    expect(cli(root, 'lint').code).toBe(0);
    expect(exists(root, '.eslintcache/.cache_1')).toBe(true);
    expect(read(root, '.eslintcache/key')).toBe(key);

    write(root, 'eslint.config.mjs', `${read(root, 'eslint.config.mjs')}\n// a rule turned on\n`);
    expect(cli(root, 'lint').code).toBe(0);
    expect(exists(root, '.eslintcache/.cache_1')).toBe(false);
    expect(read(root, '.eslintcache/key')).not.toBe(key);
  });

  it('lints every file again with --no-cache, and leaves the cache where it was', () => {
    installEslint([]);

    expect(cli(root, 'lint').code).toBe(0);
    write(root, '.eslintcache/.cache_1', '{}');

    expect(cli(root, 'lint', '--no-cache').code).toBe(0);
    expect(JSON.parse(read(root, 'cache.json'))).toEqual({});
    expect(exists(root, '.eslintcache/.cache_1')).toBe(true);
  });
});

describe('ddd-ts-kit lint --json', () => {
  it('answers the verdict and the JSON report of ESLint on one line, and nothing on stderr', () => {
    installEslint([
      { ruleId: 'max-depth', severity: 1 },
      { ruleId: 'no-var', severity: 2 },
    ]);

    const result = cli(root, 'lint', 'src', '--json');

    expect(result.code).toBe(1);
    expect(result.stdout.split('\n')).toHaveLength(1);
    expect(read(root, 'formatter.txt')).toBe('json');
    expect(result.stderr).toBe('');

    expect(result.json()).toEqual({
      errors: 1,
      warnings: 1,
      inTransition: [],
      report: [
        {
          filePath: 'src/a.ts',
          messages: [
            { ruleId: 'max-depth', severity: 1 },
            { ruleId: 'no-var', severity: 2 },
          ],
        },
      ],
    });
  });

  it('answers a clean run with zero counts and exit 0', () => {
    installEslint([]);

    const result = cli(root, 'lint', '--json');

    expect(result.code).toBe(0);
    expect(result.json()).toMatchObject({ errors: 0, warnings: 0 });
  });
});

describe('ddd-ts-kit lint refuses with a next step', () => {
  it('refuses a project without ESLint, naming the install', () => {
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });

    const result = cli(root, 'lint');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('ESLint is not installed');
    expect(result.stderr).toContain('pnpm install --frozen-lockfile');
  });

  it('refuses a pattern that matches no file, with the next step and without a stack', () => {
    installEslint([]);

    const result = cli(root, 'lint', 'nothere.ts');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain('error: No file matches nothere.ts.');
    expect(result.stderr).toContain('fix: Name files or folders of the project');
    expect(result.stderr).not.toContain('NoFilesFoundError');
  });

  it('refuses a formatter ESLint cannot load, with the next step and without a stack', () => {
    installEslint([]);

    const result = cli(root, 'lint', '--format', 'nope');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain('error: ESLint has no formatter named "nope".');
    expect(result.stderr).toContain('fix: Use one of its formatters');
    expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  });

  it('prints the failure of ESLint itself and exits 2', () => {
    installEslint([]);
    write(root, 'node_modules/eslint/index.js', "throw new Error('the config does not load');\n");

    const result = cli(root, 'lint');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('the config does not load');
  });
});
