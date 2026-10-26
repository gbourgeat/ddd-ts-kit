import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLockedFiles, type RunTool } from '../src/acceptance/check-locked-files';
import { cli, tempDir, write } from './helpers';
import { initProject } from './support/init-project';

const SPEC = 'test/e2e/change-service.e2e.spec.ts';

const STORY = `# FIX-9 A change keeps its service

## Statement

A change loses its service.

## Regression

- ${SPEC}
`;

/** A tool package whose command line answers as given, standing for Biome or ESLint. */
function fakeTool(root: string, name: string, bin: string, source: string): void {
  const directory = path.join(root, 'node_modules', name);

  fs.mkdirSync(path.join(directory, path.dirname(bin)), { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, bin: { [path.basename(bin)]: bin } }));
  fs.writeFileSync(path.join(directory, bin), source);
}

function projectWith(scripts: Record<string, string>): string {
  const root = tempDir('lock-checks');

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));

  return root;
}

describe('the checks before a lock, unit', () => {
  it('checks nothing without a format or a lint script, and says so', () => {
    const checked = checkLockedFiles(projectWith({}), [SPEC], { run: () => ({ status: 1, output: 'never run' }) });

    expect(checked.findings).toEqual([]);
    expect(checked.unchecked).toHaveLength(2);
  });

  it('runs the formatter in check mode and the linter on the files only, and names what they report', () => {
    const root = projectWith({ format: 'biome format --write .', lint: 'ddd-ts-kit lint' });

    fakeTool(root, '@biomejs/biome', 'bin/biome', '');
    fakeTool(root, 'eslint', 'bin/eslint.js', '');

    const calls: string[][] = [];

    const run: RunTool = (_program, args) => {
      calls.push([...args]);

      return { status: 1, output: `${SPEC}\n  12:3  error  missing blank line` };
    };

    const checked = checkLockedFiles(root, [SPEC], { run, cli: '/kit/bin.js' });

    expect(calls.map((args) => args.slice(1))).toEqual([
      ['format', '--no-errors-on-unmatched', SPEC],
      ['lint', '--no-cache', SPEC],
    ]);

    expect(checked.findings).toHaveLength(2);
    expect(checked.findings.join('\n')).toContain(`${SPEC}\n  12:3  error  missing blank line`);
  });

  it('passes a file the tools accept', () => {
    const root = projectWith({ format: 'prettier --write .', lint: 'eslint .' });

    fakeTool(root, 'prettier', 'bin/prettier', '');
    fakeTool(root, 'eslint', 'bin/eslint.js', '');

    const calls: string[][] = [];

    const run: RunTool = (_program, args) => {
      calls.push([...args]);

      return { status: 0, output: '' };
    };

    const checked = checkLockedFiles(root, [SPEC], { run });

    expect(checked).toEqual({ findings: [], unchecked: [] });

    expect(calls.map((args) => args.slice(1))).toEqual([
      ['--check', SPEC],
      ['--max-warnings', '0', SPEC],
    ]);
  });
});

describe('the lock of a fix whose spec fails the formatter of the project', () => {
  it('is refused with the finding, and nothing is written; locked once the file passes', () => {
    const root = initProject('--context', 'ordering:core');

    write(root, 'docs/architecture/stories/FIX-9.md', STORY);
    write(root, SPEC, "import { it } from 'vitest';\n\nit('#FIX-9 keeps the service', async () => {});\n");

    fakeTool(
      root,
      '@biomejs/biome',
      'bin/biome',
      "const fs = require('node:fs');\nconst bad = fs.readFileSync(process.argv[process.argv.length - 1], 'utf8').includes('BAD');\nif (bad) { console.error('format: a line to wrap'); }\nprocess.exit(bad ? 1 : 0);\n",
    );

    write(root, SPEC, `// BAD\n${fs.readFileSync(path.join(root, SPEC), 'utf8')}`);

    const refused = cli(root, 'acceptance', 'FIX-9', '--lock');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain(`${SPEC} fails the checks of the project`);
    expect(refused.stderr).toContain('format: a line to wrap');
    expect(fs.existsSync(path.join(root, 'test/acceptance/fix-9.acceptance.lock.json'))).toBe(false);

    write(root, SPEC, "import { it } from 'vitest';\n\nit('#FIX-9 keeps the service', async () => {});\n");

    const locked = cli(root, 'acceptance', 'FIX-9', '--lock');

    expect(locked.code).toBe(0);
    expect(fs.existsSync(path.join(root, 'test/acceptance/fix-9.acceptance.lock.json'))).toBe(true);
  });
});
