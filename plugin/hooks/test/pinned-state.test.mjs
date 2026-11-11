// What a worker's code changes of the guard's own ground does not lift it: the mode of the guard is
// pinned with its scope, and a branch the worker merges is its own work, only the trunk is the trunk's.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { bash, committed, decision, git, patchConfig, put, reason, run, runFrom, worker, write } from './support.mjs';

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
  git(root, 'tag', 'merged-tip');
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
  // From a session that stands in no project, the worker is judged the same.
  const elsewhere = bash(dirname(root), `cd ${root} && npm test`, { ...agent, agent_id: 'wave-elsewhere' });
  assert.equal(run('pre-bash', elsewhere).output, undefined);
  // And so is a host that sends no working directory: the guard reads the one it starts in.
  const { cwd, ...sent } = bash(root, 'npm test', { ...agent, agent_id: 'wave-no-cwd' });
  assert.equal(runFrom(cwd, 'pre-bash', sent).output, undefined);
});

test('a note an earlier version of the guard took, without the trunks, is compared with the trunks as they stand', () => {
  const root = workerOfAWave('work/wave-1', { base: 'work/wave-1' });
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'merge', agent_id: 'old-note' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  const state = join(root, '.ddd-ts-kit/guard');
  const note = join(
    state,
    readdirSync(state).find((name) => name.startsWith('before-run-')),
  );
  const { trunks, ...earlier } = JSON.parse(readFileSync(note, 'utf8'));
  assert.equal(trunks.length, 2);
  writeFileSync(note, JSON.stringify(earlier));
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge the wave', 'work/wave-1');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
});

test('a merge of a branch that is no trunk is held, and the worker is told to report it, not to undo it', () => {
  // A base is a branch of the repository other than the worker's own: never HEAD, an alias of its
  // branch, a tag or a commit.
  const bases = ['work/wave-1', 'work/ordering', 'work/gone', '--all', 'HEAD', 'heads/work/ordering', 'merged-tip'];
  for (const scope of bases.map((base) => ({ base }))) {
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

function gitOutput(root, ...args) {
  const identity = ['-c', 'user.name=guard', '-c', 'user.email=guard@example.test', '-c', 'commit.gpgsign=false'];
  return spawnSync('git', [...identity, ...args], { cwd: root, encoding: 'utf8' }).stdout.trim();
}

// A worker on `work/ordering`, cut from `main`, pinned by a first command; then a commit that is on
// no branch, changing files outside its scope, is merged into its branch, as code it ran could do.
function mergedOffEveryBranch(id) {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const scope = { context: 'ordering', base: 'main', baseCommit: gitOutput(root, 'rev-parse', 'HEAD') };
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ ...scope, branch: 'work/ordering' }));
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'off-branch', agent_id: id };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  writeFileSync(join(root, 'src/main.ts'), `${readFileSync(join(root, 'src/main.ts'), 'utf8')}// changed\n`);
  put(root, 'src/platform/added.ts', 'export {};\n');
  git(root, 'add', '--all');
  const side = gitOutput(root, 'commit-tree', gitOutput(root, 'write-tree'), '-p', 'HEAD', '-m', 'side');
  git(root, 'reset', '--hard', '--quiet', 'HEAD');
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge', side);
  return { root, agent, side, scope: { ...scope, branch: 'work/ordering' } };
}

function stopOf(root, agent) {
  return run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false }).output;
}

test('a merge of a commit no trunk held before the command is held, whatever the trunk names afterwards', () => {
  const moves = [
    () => undefined,
    ({ root, side }) => git(root, 'update-ref', 'refs/heads/main', side),
    ({ root, side }) => git(root, 'update-ref', 'refs/remotes/origin/HEAD', side),
  ];
  for (const [index, move] of moves.entries()) {
    const made = mergedOffEveryBranch(`moved-${index}`);
    move(made);
    const stopped = run('pre-bash', bash(made.root, 'npm test', made.agent));
    assert.equal(decision(stopped), 'deny', `move ${index}`);
    assert.match(reason(stopped), /A merge brought files outside your scope into your branch: src\/main\.ts/);
    const own = write(join(made.root, 'src/contexts/ordering/CONTEXT.md'), made.agent);
    assert.equal(decision(run('pre-write', own)), 'deny', `move ${index}`);
    assert.match(stopOf(made.root, made.agent).reason, /src\/platform\/added\.ts/);
  }
});

test("the scope file is the conductor's: its base, its base commit or its branch changed since the pin stops the worker", () => {
  const forgeries = [
    () => ({ base: 'HEAD' }),
    ({ side }) => ({ base: side }),
    () => ({ base: 'heads/work/ordering' }),
    () => ({ base: 'ORIG_HEAD' }),
    ({ root }) => ({ baseCommit: gitOutput(root, 'rev-parse', 'HEAD') }),
    () => ({ branch: 'main' }),
    () => ({ base: undefined }),
  ];
  for (const [index, forge] of forgeries.entries()) {
    const made = mergedOffEveryBranch(`forged-${index}`);
    put(made.root, '.ddd-ts-kit/worker.json', JSON.stringify({ ...made.scope, ...forge(made) }));
    const stopped = run('pre-bash', bash(made.root, 'npm test', made.agent));
    assert.equal(decision(stopped), 'deny', `forgery ${index}`);
    assert.match(
      reason(stopped),
      /The scope file changed: .* its base, its base commit or its branch is not what it was/,
    );
    const own = write(join(made.root, 'src/contexts/ordering/CONTEXT.md'), made.agent);
    assert.equal(decision(run('pre-write', own)), 'deny', `forgery ${index}`);
    const stop = stopOf(made.root, made.agent);
    assert.match(stop.reason ?? stop.systemMessage, /The scope file changed/, `forgery ${index}`);
    // Once the conductor restored it, the merge is still what it was.
    put(made.root, '.ddd-ts-kit/worker.json', JSON.stringify(made.scope));
    assert.match(reason(run('pre-bash', bash(made.root, 'npm test', made.agent))), /A merge brought files/);
  }
});
