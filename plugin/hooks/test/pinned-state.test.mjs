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

// A worker on `work/ordering`, cut from the integration branch `work/wave-1` its scope file records
// as its base, itself ahead of `main`; `branch` then gains a commit outside the scope of the worker.
function workerOfAWave(branch, scope) {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/wave-1');
  put(root, 'src/platform/of-the-wave.ts', 'export {};\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'wave');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'ordering', ...scope }));
  git(root, 'checkout', '--quiet', ...(branch === 'work/wave-1' ? [] : ['-b']), branch);
  put(root, 'src/platform/merged.ts', 'export {};\n');
  writeFileSync(join(root, 'src/main.ts'), `${readFileSync(join(root, 'src/main.ts'), 'utf8')}// merged\n`);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'merged');
  git(root, 'checkout', '--quiet', 'work/ordering');
  return root;
}

test("the base the scope file records is a trunk: what an integration branch brings in by a merge stays the trunk's", () => {
  const root = workerOfAWave('work/wave-1', { base: 'work/wave-1' });
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'merge', agent_id: 'wave' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge the wave', 'work/wave-1');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent)).output, undefined);
});

test('a merge of a branch that is no trunk is held, and the worker is told to report it, not to undo it', () => {
  for (const scope of [{ base: 'work/wave-1' }, { base: 'work/ordering' }, { base: 'work/gone' }, { base: '--all' }]) {
    const root = workerOfAWave('work/billing', scope);
    const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'merge', agent_id: 'sibling' };
    assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined, scope.base);
    git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge a sibling', 'work/billing');
    const stopped = run('pre-bash', bash(root, 'npm test', agent));
    assert.equal(decision(stopped), 'deny', scope.base);
    assert.match(reason(stopped), /A merge brought files outside your scope into your branch: /);
    assert.match(reason(stopped), /src\/platform\/merged\.ts/);
    assert.match(reason(stopped), /report the merge to the conductor/);
    assert.doesNotMatch(reason(stopped), /Put them back|`git (?:checkout|rm) [^`]*src\//);
  }
});

test('a file a merge brought in and a file the worker changed are told apart in one refusal', () => {
  const root = workerOfAWave('work/billing', { base: 'work/wave-1' });
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'merge', agent_id: 'both' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge a sibling', 'work/billing');
  writeFileSync(join(root, 'README.md'), 'changed\n');
  const stopped = reason(run('pre-bash', bash(root, 'npm test', agent)));
  assert.match(
    stopped,
    /Your commands, or another session, changed files outside your scope: README\.md\. Put them back/,
  );
  assert.match(stopped, /`git checkout HEAD -- README\.md`/);
  assert.match(
    stopped,
    /A merge brought files outside your scope into your branch: src\/main\.ts, src\/platform\/merged\.ts\./,
  );
});
