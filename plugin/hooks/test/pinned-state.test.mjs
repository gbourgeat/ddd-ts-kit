// What a worker's code changes of the guard's own ground does not lift it: the mode of the guard is
// pinned with its scope, and a branch the worker merges is its own work, only the trunk is the trunk's.

import assert from 'node:assert/strict';
import { chmodSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

test("a note whose trunks git cannot read shows no merge as the trunk's", () => {
  const root = workerOfAWave('work/wave-1', { base: 'work/wave-1' });
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'merge', agent_id: 'unread-trunks' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  const state = join(root, '.ddd-ts-kit/guard');
  const note = join(
    state,
    readdirSync(state).find((name) => name.startsWith('before-run-')),
  );
  writeFileSync(note, JSON.stringify({ ...JSON.parse(readFileSync(note, 'utf8')), trunks: ['no-commit'] }));
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge the wave', 'work/wave-1');
  assert.match(reason(run('pre-bash', bash(root, 'npm test', agent))), /A merge brought files outside your scope/);
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

function gitOutput(root, ...args) {
  const identity = ['-c', 'user.name=guard', '-c', 'user.email=guard@example.test', '-c', 'commit.gpgsign=false'];
  return spawnSync('git', [...identity, ...args], { cwd: root, encoding: 'utf8' }).stdout.trim();
}

function stopOf(root, agent) {
  return run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false }).output;
}

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

test('the merge of the kit is noted when it is asked for another trunk than the base of the worker', () => {
  for (const [trunk, merged, held] of [
    ['--trunk work/billing', 'work/billing', true],
    ['--trunk=work/billing', 'work/billing', true],
    ['--trunk', 'work/billing', true],
    ['--trunk work/wave-1', 'work/wave-1', false],
    ['', 'work/wave-1', false],
    ['--trunk work/wave-1 --trunk work/billing', 'work/billing', true],
    ['--trunk=work/wave-1 --trunk=work/billing', 'work/billing', true],
    ['--trunk work/wave-1 --trunk=work/billing', 'work/billing', true],
    ['--trunk work/billing --trunk work/wave-1', 'work/billing', true],
    ['--trunk work/wave-1 --trunk', 'work/billing', true],
    ['--trunks work/wave-1', 'work/billing', true],
  ]) {
    const root = workerOfAWave('work/billing', { base: 'work/wave-1' });
    const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'kit-merge', agent_id: trunk };
    assert.equal(run('pre-bash', bash(root, `npx ddd-ts-kit merge-trunk ${trunk}`, agent)).output, undefined, trunk);
    git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge', merged);
    const next = run('pre-bash', bash(root, 'git status', agent));
    assert.equal(decision(next), held ? 'deny' : undefined, trunk);
  }
});

test('a branch that merged its trunk hundreds of times is read by a bounded number of runs of git', () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const scope = { context: 'ordering', base: 'main', baseCommit: gitOutput(root, 'rev-parse', 'HEAD') };
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify(scope));
  manyTrunkMerges(root, 300);
  const bin = join(root, '..', `counted-${Date.now()}`);
  const log = join(bin, 'runs.log');
  put(bin, 'git', `#!/bin/sh\necho run >> ${log}\nexec ${gitOutput(root, '--exec-path')}/git "$@"\n`);
  chmodSync(join(bin, 'git'), 0o755);
  const counted = { PATH: `${bin}:${process.env.PATH}` };
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'many', agent_id: 'merges' };
  run('pre-bash', bash(root, 'git status', agent), counted);
  assert.equal(run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false }, counted).output, undefined);
  const runs = readFileSync(log, 'utf8').split('\n').filter(Boolean).length;
  assert.ok(runs < 60, `${runs} runs of git`);
  // One file the worker committed among them is still found.
  put(root, 'src/platform/own.ts', 'export {};\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'feat: outside');
  const stopped = run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false }, counted).output;
  assert.match(stopped.reason, /outside your scope since its base [0-9a-f]+: src\/platform\/own\.ts\./);
});

// A branch that merged its trunk `count` times, each merge bringing in a file outside the scope, built
// by one process of git.
function manyTrunkMerges(root, count) {
  const stream = [];
  for (let index = 1; index <= count; index += 1) {
    const file = `M 100644 inline src/platform/trunk-${index}.ts\ndata 11\nexport {};\n`;
    const who = `committer guard <guard@example.test> ${1700000000 + index} +0000`;
    const from = (branch) => (index === 1 ? `from refs/heads/${branch}^0\n` : '');
    stream.push(
      `commit refs/heads/main\nmark :${index * 2}\n${who}\ndata 5\ntrunk\n${from('main')}${file}`,
      `commit refs/heads/work/ordering\nmark :${index * 2 + 1}\n${who}\ndata 5\nmerge\n${from('work/ordering')}merge :${index * 2}\n${file}`,
    );
  }
  const imported = spawnSync('git', ['fast-import', '--quiet'], {
    cwd: root,
    input: stream.join('\n'),
    encoding: 'utf8',
  });
  assert.equal(imported.status, 0, imported.stderr);
  git(root, 'reset', '--quiet', '--hard', 'work/ordering');
}

test('a merge of an earlier commit of the trunk does not excuse a tree that drops what the trunk brought since', () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  const earlier = gitOutput(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'ordering', base: 'main' }));
  git(root, 'checkout', '--quiet', 'main');
  put(root, 'src/platform/of-the-trunk.ts', 'export {};\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'trunk');
  git(root, 'checkout', '--quiet', 'work/ordering');
  git(root, 'merge', '--quiet', '--no-ff', '--no-verify', '--message', 'merge main', 'main');
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'earlier', agent_id: 'side' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  // A merge whose tree is the one of the earlier commit: what the trunk added since is gone from it.
  const tree = gitOutput(root, 'rev-parse', `${earlier}^{tree}`);
  const merge = gitOutput(root, 'commit-tree', tree, '-p', 'HEAD', '-p', earlier, '-m', 'merge');
  git(root, 'reset', '--quiet', '--hard', merge);
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /src\/platform\/of-the-trunk\.ts/);
});

test('a comparison git cannot make holds the call: nothing is taken as unchanged', () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const head = gitOutput(root, 'rev-parse', 'HEAD');
  put(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'ordering', base: 'main', baseCommit: head }));
  const agent = { agent_type: 'ddd-ts-kit:context-builder', session_id: 'unread', agent_id: 'objects' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  put(root, 'src/main.ts', 'export const changed = true;\n');
  git(root, 'commit', '--quiet', '--no-verify', '--all', '--message', 'feat: outside');
  // The commit the note was taken at is no longer in the repository.
  rmSync(join(root, '.git/objects', head.slice(0, 2), head.slice(2)));
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /could not compare/);
  assert.equal(decision(run('pre-bash', bash(root, 'git status', agent))), 'deny');
  const stop = stopOf(root, agent);
  assert.match(stop.reason, /could not compare/);
});

test('a file held to a commit git can no longer read is not taken as put back', () => {
  const root = committed({ worktrees: 'advised' });
  git(root, 'branch', '-M', 'main');
  git(root, 'checkout', '--quiet', '-b', 'work/ordering');
  const head = gitOutput(root, 'rev-parse', 'HEAD');
  const agent = { ...worker(root, 'ordering'), session_id: 'unread', agent_id: 'held' };
  assert.equal(run('pre-bash', bash(root, 'node -e "1"', agent)).output, undefined);
  put(root, 'src/main.ts', 'export const changed = true;\n');
  git(root, 'commit', '--quiet', '--no-verify', '--all', '--message', 'feat: outside');
  assert.match(
    reason(run('pre-bash', bash(root, 'npm test', agent))),
    /changed files outside your scope: src\/main\.ts/,
  );
  rmSync(join(root, '.git/objects', head.slice(0, 2), head.slice(2)));
  const still = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(still), 'deny');
  assert.match(reason(still), /changed files outside your scope: src\/main\.ts/);
});
