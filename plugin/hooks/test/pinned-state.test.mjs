// What a worker's code changes of the guard's own ground does not lift it: the mode of the guard is
// pinned with its scope, and a branch the worker merges is its own work, only the trunk is the trunk's.

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, git, patchConfig, put, reason, run, worker, write } from './support.mjs';

test('a config of the worktree that turns the guard off, or grows past what it reads, does not lift a pinned worker', () => {
  for (const [name, change] of [
    ['off', (root) => patchConfig(root, { guard: 'off' })],
    ['too-large', (root) => writeFileSync(join(root, 'ddd-ts-kit.config.json'), ' '.repeat(300 * 1024))],
  ]) {
    const root = committed({ worktrees: 'advised' });
    const agent = { ...worker(root, 'ordering'), session_id: 'mode', agent_id: name };
    assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined, name);
    change(root);
    const stopped = run('pre-bash', bash(root, 'npm test', agent));
    assert.equal(decision(stopped), 'deny', name);
    assert.match(reason(stopped), /ddd-ts-kit\.config\.json/, name);
    assert.equal(decision(run('pre-write', write(join(root, 'src/main.ts'), agent))), 'deny', name);
  }
});

test('what a worker commits on a branch of its own and merges back is held, as a commit of its branch is', () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const agent = { ...worker(root, 'ordering'), session_id: 'merge', agent_id: 'side' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  git(root, 'checkout', '--quiet', '-b', 'side');
  writeFileSync(join(root, 'src/main.ts'), `${readFileSync(join(root, 'src/main.ts'), 'utf8')}// changed\n`);
  git(root, 'commit', '--quiet', '--no-verify', '--all', '--message', 'side');
  git(root, 'checkout', '--quiet', 'work/ordering');
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge side', 'side');
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /src\/main\.ts/);
});

test("what the trunk brings in by a merge stays the trunk's", () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const agent = { ...worker(root, 'ordering'), session_id: 'merge', agent_id: 'trunk' };
  git(root, 'checkout', '--quiet', 'main');
  put(root, 'src/platform/from-trunk.ts', 'export {};\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'trunk');
  git(root, 'checkout', '--quiet', 'work/ordering');
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge main', 'main');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
});
