import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCRIPT_RUNNERS } from '../src/refuse-windows-shell';
import { run } from '../src/run';
import { committedProject } from './support/committed-project';
import { exists, walk } from './helpers';
import { git } from './support/git';
import { PAY_AND_CANCEL } from './support/invoicing-merge';
import { mergeRepository } from './support/merge-repository';
import { merging } from './support/trunk-history';
import { initProject } from './support/init-project';

const SOURCES = path.resolve(import.meta.dirname, '../src');

/** What the CLI printed and answered, with the platform it was told it runs on. */
function runOn(platform: NodeJS.Platform, root: string, ...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];

  const code = run(
    [...args, '--cwd', root],
    { out: (text) => out.push(text), err: (text) => err.push(text) },
    { platform },
  );

  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

/** The commands that reach a package manager, by the file of `src` that does, so that a new spawn is listed or fails. */
const REACHED_BY: Readonly<Record<string, readonly string[]>> = {
  'affected/run-affected.ts': ['affected'],
  'merge/merge-steps.ts': ['merge-trunk'],
  'slice/run-script.ts': ['verify-slice', 'merge-trunk'],
  'worker/install-dependencies.ts': ['worker-scope', 'story-scope', 'worktree'],
};

const sources = walk(SOURCES)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, text: fs.readFileSync(path.join(SOURCES, file), 'utf8') }));

describe('the commands that run a script of the project, on Windows outside WSL 2', () => {
  it('refuse at their entry with exit code 2, the reason and WSL 2 as the way out, and print nothing else', () => {
    const root = initProject();
    const result = runOn('win32', root, 'affected', '--run', 'test');

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('under WSL 2 only: outside it the package manager is reached through cmd.exe');
    expect(result.stderr).toContain('fix: Run this command under WSL 2 (docs/guides/agent-sandbox.md).');
  });

  it.each([
    ['verify-slice', ['billing']],
    ['worker-scope', ['billing']],
    ['story-scope', ['US1']],
    ['worktree', ['feature']],
    ['merge-trunk', []],
  ])('refuse %s', (command, rest) => {
    const result = runOn('win32', initProject(), command, ...rest);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('WSL 2');
  });

  it('refuse worker-scope before any side effect: no worktree, no branch, no file', () => {
    const root = committedProject('shop', '--context', 'billing:core');
    const before = walk(root).sort();

    expect(runOn('win32', root, 'worker-scope', 'billing').code).toBe(2);

    expect(exists(root, '.worktrees')).toBe(false);
    expect(git(root, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
    expect(git(root, 'branch', '--list', 'build/*').trim()).toBe('');
    expect(walk(root).sort()).toEqual(before);
  });

  it('refuse merge-trunk before any side effect: no merge in progress, nothing written', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const before = git(root, 'rev-parse', 'HEAD');

    expect(runOn('win32', root, 'merge-trunk', '--trunk', 'main').code).toBe(2);

    expect(merging(root)).toBe(false);
    expect(exists(root, '.ddd-ts-kit')).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('leave a command that runs no script alone, and the options that skip the install', () => {
    const root = initProject();

    expect(runOn('win32', root, 'affected').code).not.toBe(2);
    expect(runOn('win32', root, 'worktree', 'feature', '--dry-run').stderr).not.toContain('WSL 2');
    expect(runOn('win32', root, 'worktree', 'feature', '--no-install', '--dry-run').stderr).not.toContain('WSL 2');
    expect(runOn('win32', root, 'list').code).toBe(0);
  });

  it.each(['linux', 'darwin'] as const)('are not refused on %s, which is also what WSL reports', (platform) => {
    const root = mergeRepository(PAY_AND_CANCEL);

    expect(runOn(platform, root, 'merge-trunk', '--trunk', 'main').stderr).not.toContain('WSL 2');
    expect(merging(root)).toBe(true);
  });

  it('are every command that reaches a package manager: a new spawn or call fails until its command is listed', () => {
    const spawnsOfAManager = sources
      .filter(({ text }) => /spawnSync\(\s*(?!'git'|process\.execPath|program, \[\.\.\.args\])\S/.test(text))
      .map(({ file }) => file);

    const callers = sources
      .filter(
        ({ file, text }) =>
          /\b(runScript|installDependencies)\(/.test(text) &&
          !file.endsWith('run-script.ts') &&
          !file.endsWith('install-dependencies.ts'),
      )
      .map(({ file }) => file);

    expect(spawnsOfAManager.sort()).toEqual(Object.keys(REACHED_BY).sort());

    expect(callers.sort()).toEqual(
      [
        'merge/continue-merge.ts',
        'slice/verify-slice.ts',
        'stories/open-story-scope.ts',
        'worker/open-worker-scope.ts',
        'worktree/open-worktree.ts',
      ].sort(),
    );

    expect(
      Object.values(REACHED_BY)
        .flat()
        .filter((command) => !Object.hasOwn(SCRIPT_RUNNERS, command)),
    ).toEqual([]);

    expect(Object.keys(SCRIPT_RUNNERS).sort()).toEqual([...new Set(Object.values(REACHED_BY).flat())].sort());
  });
});
