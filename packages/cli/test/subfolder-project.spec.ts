import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';
import { git } from './support/git';

/** A repository whose top holds `apps/api`, where the project is initialised. */
function monorepo(): string {
  const top = tempDir('subfolder-project');
  const root = path.join(top, 'apps', 'api');

  git(top, 'init', '--quiet');

  return root;
}

describe('a project in a folder of a larger git repository', () => {
  it('init names the files read at the top only, and where allowBuilds belongs', () => {
    const root = monorepo();
    const result = cli(root, 'init', '--context', 'billing:core', '--package-manager', 'pnpm');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('This project is in apps/api, not at the top of the git repository');
    expect(result.stdout).toContain('lefthook.yml are read at the top of the git repository only');
    expect(result.stdout).toContain('pnpm-workspace.yaml of the workspace root');
  });

  it('doctor reports it, and fixes nothing by itself', () => {
    const root = monorepo();

    cli(root, 'init', '--context', 'billing:core', '--package-manager', 'pnpm');

    const result = cli(root, 'doctor');

    expect(result.stdout).toContain('hook project folder: written otherwise');
    expect(result.stdout).toContain('working-directory: apps/api');
  });

  it('says nothing at the top of the repository', () => {
    const root = tempDir('subfolder-top');

    git(root, 'init', '--quiet');

    const result = cli(root, 'init', '--context', 'billing:core', '--package-manager', 'pnpm');

    expect(result.stdout).not.toContain('not at the top of the git repository');
    expect(cli(root, 'doctor').stdout).not.toContain('project folder');
  });
});
