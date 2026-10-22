import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { git } from './support/git';
import { installKit } from './support/install-kit';
import { jsonAt } from './support/json-at';

let root: string;

function changeManifest(change: (manifest: Record<string, Record<string, string>>) => void): void {
  const manifest: Record<string, Record<string, string>> = JSON.parse(read(root, 'package.json'));

  change(manifest);
  write(root, 'package.json', JSON.stringify(manifest, null, 2));
}

beforeEach(() => {
  root = path.join(tempDir('doctor'), 'shop');
  cli(root, 'init', '--context', 'billing:core', '--package-manager', 'npm');
  installKit(root);
});

describe('doctor', () => {
  it('says that a project just initialised has what this version writes', () => {
    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('The project has what ddd-ts-kit');
    expect(result.stdout).toContain('This checkout runs it: the Node it asks');
  });

  it('names a missing script, a package of the kit at another range and a missing permission, and how to take them', () => {
    changeManifest((manifest) => {
      delete manifest['scripts']?.['regenerate'];
      (manifest['dependencies'] ?? {})['@ddd-ts-kit/kernel'] = '^0.1.0';
    });

    write(root, '.claude/settings.json', JSON.stringify({ permissions: { allow: [] } }));

    const result = cli(root, 'doctor');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      '  script regenerate: missing (ddd-ts-kit depcruise-config --write && npm run docs:generate)',
    );

    expect(result.stdout).toContain('  package @ddd-ts-kit/kernel: other version (range ^');
    expect(result.stdout).toContain('  permission allow Bash(npx ddd-ts-kit verify-slice *): missing');
    expect(result.stdout).toContain('fix: `npx ddd-ts-kit init` adds what is missing');
    expect(result.stdout).toContain('fix: upgrade `ddd-ts-kit` and every `@ddd-ts-kit/*` package together');
    expect(cli(root, 'doctor', '--strict').code).toBe(1);
  });

  it('reports a script written otherwise without failing --strict on it, in JSON too', () => {
    changeManifest((manifest) => {
      (manifest['scripts'] ?? {})['regenerate'] = 'echo done';
    });

    const result = cli(root, 'doctor', '--strict', '--json');

    expect(result.code).toBe(0);

    expect(jsonAt(result.json(), 'findings')).toEqual([
      expect.objectContaining({ area: 'script', name: 'regenerate', problem: 'written otherwise', found: 'echo done' }),
    ]);
  });
});

describe('doctor, on the review policy', () => {
  it('names a missing REVIEW.md, the file init writes once for the team, failing --strict', () => {
    fs.rmSync(path.join(root, 'REVIEW.md'));

    const result = cli(root, 'doctor');

    expect(result.stdout).toContain('  guidance REVIEW.md: missing (the file init writes)');
    expect(result.stdout).toContain('fix: `npx ddd-ts-kit init` adds what is missing');
    expect(cli(root, 'doctor', '--strict').code).toBe(1);

    cli(root, 'init');

    expect(cli(root, 'doctor', '--strict').code).toBe(0);
  });
});

describe('doctor, on the git hooks', () => {
  it('names a lefthook.yml without its lefthook line, and how to take it, failing --strict', () => {
    write(root, 'lefthook.yml', read(root, 'lefthook.yml').replace(/^lefthook: .*\n/m, ''));

    const result = cli(root, 'doctor');

    expect(result.stdout).toContain('  hook lefthook.yml lefthook: missing (lefthook: node_modules/.bin/lefthook)');

    expect(result.stdout).toContain(
      'fix: add the line `lefthook: node_modules/.bin/lefthook` at the top of lefthook.yml',
    );

    expect(result.stdout).toContain('`npx ddd-ts-kit init --force`');
    expect(result.stdout).not.toContain('fix: `npx ddd-ts-kit init` adds what is missing');
    expect(cli(root, 'doctor', '--strict').code).toBe(1);
  });

  it('names a lefthook.yml without the secrets job, and how to take it, failing --strict', () => {
    write(root, 'lefthook.yml', read(root, 'lefthook.yml').replace('    - name: secrets\n', '    - name: leaks\n'));

    const result = cli(root, 'doctor');

    expect(result.stdout).toContain(
      '  hook lefthook.yml secrets: missing (the pre-commit job `secrets`: gitleaks on the staged changes when it is installed, one line otherwise)',
    );

    expect(result.stdout).toContain('fix: add the `secrets` job to the pre-commit jobs of lefthook.yml');
    expect(cli(root, 'doctor', '--strict').code).toBe(1);
  });

  it('names a missing lefthook.yml', () => {
    fs.rmSync(path.join(root, 'lefthook.yml'));

    expect(cli(root, 'doctor').stdout).toContain('  hook lefthook.yml: missing (the file init writes)');
  });

  it('in a clone, says the pre-commit hook is not installed or not from lefthook, without failing --strict', () => {
    git(root, 'init', '--quiet');

    const missing = cli(root, 'doctor', '--strict');

    expect(missing.code).toBe(0);
    expect(missing.stdout).toContain('  hook pre-commit: not installed (the hook lefthook installs)');
    expect(missing.stdout).toContain('fix: `npm run hooks:install` installs the hooks of lefthook.yml in this clone');

    write(root, '.git/hooks/pre-commit', '#!/bin/sh\nexit 0\n');

    expect(jsonAt(cli(root, 'doctor', '--json').json(), 'findings')).toEqual([
      expect.objectContaining({ area: 'hook', name: 'pre-commit', problem: 'written otherwise' }),
    ]);

    write(root, '.git/hooks/pre-commit', '#!/bin/sh\ncall_lefthook run "pre-commit" "$@"\n');

    expect(cli(root, 'doctor').stdout).toContain('The project has what ddd-ts-kit');
  });

  it('speaks the package manager of the project in the fix of the hooks', () => {
    const pnpm = path.join(tempDir('doctor-pnpm'), 'shop');

    cli(pnpm, 'init', '--context', 'billing:core', '--package-manager', 'pnpm');
    git(pnpm, 'init', '--quiet');

    expect(cli(pnpm, 'doctor').stdout).toContain('fix: `pnpm run hooks:install` installs the hooks');
  });
});
