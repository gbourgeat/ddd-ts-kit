import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitArguments } from '../src/commit/git-arguments';
import { runGit } from '../src/commit/run-git';
import { tempDir } from './helpers';

const SOURCES = path.join(import.meta.dirname, '..', 'src');
const SPAWN_OF_GIT = /\b(?:spawnSync|execFileSync|execFile|spawn|execSync|exec)\(\s*['"`]git\b/g;

describe('the arguments of every git the CLI runs', () => {
  it('turn off a planted fsmonitor and the optional locks, and the hooks of a run that changes nothing', () => {
    expect(gitArguments(['status', '--porcelain'])).toEqual([
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.hooksPath=/dev/null',
      '--no-optional-locks',
      'status',
      '--porcelain',
    ]);

    expect(gitArguments(['--literal-pathspecs', 'diff', '--name-only'])).toContain('core.hooksPath=/dev/null');
    expect(gitArguments(['-C', 'commit', 'rev-parse', 'HEAD'])).toContain('core.hooksPath=/dev/null');
    expect(gitArguments(['--version'])).not.toContain('core.hooksPath=/dev/null');
  });

  it('keep the hooks of the project on commit, merge and the other writes, which are its gates', () => {
    for (const args of [
      ['commit', '-m', 'x'],
      ['merge', '--no-ff', 'main'],
      ['-C', 'status', 'add', '--all'],
    ]) {
      expect(gitArguments(args)).toEqual(['-c', 'core.fsmonitor=false', '--no-optional-locks', ...args]);
    }
  });

  it('run no fsmonitor and no hook a repository planted, and still the pre-commit hook of a commit', () => {
    const repo = repository();

    write(repo, '.git/hooks/post-index-change', `#!/bin/sh\ntouch "${path.join(repo, 'post-index-change-ran')}"\n`);
    write(repo, '.git/hooks/pre-commit', `#!/bin/sh\ntouch "${path.join(repo, 'pre-commit-ran')}"\n`);
    git(repo, 'config', 'core.fsmonitor', `touch "${path.join(repo, 'fsmonitor-ran')}"; false`);
    fs.writeFileSync(path.join(repo, 'a.txt'), 'changed\n');

    expect(runGit(repo, ['status', '--porcelain'])).toContain('a.txt');
    expect(runGit(repo, ['diff', '--name-only'])).toBe('a.txt\n');

    expect(['fsmonitor-ran', 'post-index-change-ran'].filter((file) => fs.existsSync(path.join(repo, file)))).toEqual(
      [],
    );

    runGit(repo, ['commit', '--quiet', '--all', '--message', 'change']);

    expect(fs.existsSync(path.join(repo, 'pre-commit-ran'))).toBe(true);
  });

  it('are the only ones: every spawn of git in the sources takes them from gitArguments', () => {
    const spawns = sourceFiles(SOURCES).flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8');

      return [...text.matchAll(SPAWN_OF_GIT)].map((match) => ({
        file: path.relative(SOURCES, file),
        throughTheHelper: /^\(\s*['"`]git['"`],\s*gitArguments\(/.test(
          text.slice((match.index ?? 0) + match[0].indexOf('(')),
        ),
      }));
    });

    expect(spawns.length).toBeGreaterThanOrEqual(9);
    expect(spawns.filter((spawn) => !spawn.throughTheHelper)).toEqual([]);
  });
});

function repository(): string {
  const repo = tempDir('git-arguments');

  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.name', 'spec');
  git(repo, 'config', 'user.email', 'spec@example.test');
  git(repo, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'first\n');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '--quiet', '--no-verify', '--message', 'first');

  return repo;
}

function git(repo: string, ...args: string[]): void {
  expect(spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).status).toBe(0);
}

function write(repo: string, file: string, content: string): void {
  fs.writeFileSync(path.join(repo, file), content, { mode: 0o755 });
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);

    return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : [];
  });
}
