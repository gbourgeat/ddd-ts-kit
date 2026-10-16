import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';
import { jsonAt } from './support/json-at.js';

let root: string;

function changeManifest(change: (manifest: Record<string, Record<string, string>>) => void): void {
  const manifest: Record<string, Record<string, string>> = JSON.parse(read(root, 'package.json'));

  change(manifest);
  write(root, 'package.json', JSON.stringify(manifest, null, 2));
}

beforeEach(() => {
  root = path.join(tempDir('doctor'), 'shop');
  cli(root, 'init', '--context', 'billing:core', '--package-manager', 'npm');
});

describe('doctor', () => {
  it('says that a project just initialised has what this version writes', () => {
    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('The project has what ddd-ts-kit');
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
