// The commands no agent, or no sub-agent, runs: skipped hooks, one side of a merge, the place of a
// worker, a landing.

import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, git, project, reason, run, worker } from './support.mjs';

test('a sub-agent reads a briefing of worker-scope, and only the conductor prepares a worktree', () => {
  const root = project();
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  const preparing = run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --rows 3', reviewer));
  assert.equal(decision(preparing), 'deny');
  assert.match(reason(preparing), /--dry-run/);
  const reading = 'npx ddd-ts-kit worker-scope ordering --rows 3 --dry-run --json';
  assert.equal(run('pre-bash', bash(root, reading, reviewer)).output, undefined);
  assert.equal(
    run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --resume', reviewer)).output,
    undefined,
  );
  assert.equal(
    run('pre-bash', bash(root, 'npx ddd-ts-kit worker-scope ordering --base origin/main')).output,
    undefined,
  );
});

test('worker-scope is refused to a sub-agent however the CLI is launched', () => {
  const root = project();
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  for (const command of [
    'node packages/cli/dist/bin.js worker-scope ordering',
    'node node_modules/ddd-ts-kit/dist/bin.js worker-scope ordering --rows 3',
    'node scripts/kit.mjs worker-scope ordering',
    'npm exec ddd-ts-kit -- worker-scope ordering',
    'pnpm exec ddd-ts-kit worker-scope ordering',
    'node_modules/.bin/ddd-ts-kit worker-scope ordering',
    'bunx ddd-ts-kit@latest worker-scope ordering',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, reviewer))), 'deny', command);
  }
  for (const command of [
    'node packages/cli/dist/bin.js worker-scope ordering --dry-run',
    'grep -rn worker-scope docs',
    'git log --grep worker-scope',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, reviewer)).output, undefined, command);
  }
});

test('only the conductor lands a branch with merge-trunk --to-land; a worker brings the trunk in without it', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit merge-trunk --to-land',
    `npx ddd-ts-kit merge-trunk --to-land --cwd ${root}`,
    'node packages/cli/dist/bin.js merge-trunk --trunk origin/main --to-land',
    'node scripts/kit.mjs merge-trunk --to-land',
  ]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /Only the conductor lands a branch/);
  }
  for (const command of [
    'npx ddd-ts-kit merge-trunk',
    'npx ddd-ts-kit merge-trunk --continue',
    'npx ddd-ts-kit merge-trunk --abort',
    'git log --grep=--to-land',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit merge-trunk --to-land')).output, undefined);
});

// Each takes one side of a merge on the sources or the tests.
const ONE_SIDE = [
  'git merge -X theirs origin/main',
  'git merge --no-edit -Xours origin/main',
  'git merge --strategy-option=theirs main',
  'git merge -s ours origin/main',
  'git pull -X theirs origin main',
  'git checkout --theirs src/contexts/ordering/domain/order.aggregate.ts',
  'git checkout --ours -- src/contexts/ordering',
  'git restore --theirs test/e2e/place-order.e2e.spec.ts',
  'git checkout --theirs .',
];

// A plain merge, a squash, an unstaged path.
const NOT_ONE_SIDE = [
  'git merge origin/main',
  'git merge --no-ff --squash build/ordering',
  'git restore --staged src/contexts/ordering/domain/order.aggregate.ts',
];

test('a sub-agent never takes one side of a merge on the sources or the tests, and is pointed to merge-trunk', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [...ONE_SIDE, `cd ${root} && git checkout --theirs src`]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /resolve each hunk/);
    assert.match(reason(refused), /npx ddd-ts-kit merge-trunk --continue/);
  }
  for (const command of NOT_ONE_SIDE) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  assert.equal(decision(run('pre-bash', bash(root, 'git merge -X theirs main', reviewer))), 'deny');
  assert.equal(run('pre-bash', bash(root, 'git merge -X theirs main')).output, undefined);
});

// Each skips the hooks of the project: `--no-verify` and its short forms, other hooks, hooks turned off.
const HOOKS_SKIPPED = [
  'git commit --no-verify -m "x"',
  'git commit -n -m x',
  'git commit -anm x',
  'git commit -m x --no-verif',
  'git -C sub commit --no-verify',
  'git push --no-verify',
  'git push origin main --no-verify',
  'git merge --no-verify feature',
  'git pull --no-verify',
  'git -c core.hooksPath=/dev/null commit -m x',
  'git -c core.hooksPath=. push',
  'git --config-env=core.hooksPath=HOOKS commit -m x',
  'git --no-pager commit --no-verify -m x',
  'git config core.hooksPath /dev/null',
  'LEFTHOOK=0 git commit -m x',
  'HUSKY=0 git push',
  'env HUSKY=0 git commit -m x',
  'export LEFTHOOK=0; git commit -m x',
  'git add . && git commit --no-verify -m x',
];

// Each runs the hooks: a message or an option that only looks like a skip, a dry run, a command without git.
const HOOKS_KEPT = [
  'git commit -m "fix"',
  'git commit -m "no-verify"',
  'git commit -mnote',
  'git commit -am "n"',
  'git commit --no-edit',
  'git push -n',
  'git push --dry-run',
  'git -c user.name=x commit -m x',
  'git commit -m x -- -n',
  'HUSKY=0 npm test',
  'HUSKY=0 grep -rn git docs',
  'echo --no-verify',
];

test('a git command that skips the hooks of the project is refused, with the hooks as the local gate', () => {
  const root = project();
  for (const command of HOOKS_SKIPPED) {
    assert.equal(decision(run('pre-bash', bash(root, command))), 'deny', command);
    assert.match(reason(run('pre-bash', bash(root, command))), /local gate of the pipeline/, command);
  }
  for (const command of HOOKS_KEPT) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
  const advised = project({ guard: 'advise' });
  assert.equal(decision(run('pre-bash', bash(advised, 'git commit --no-verify -m x'))), 'ask');
  const off = project({ guard: 'off' });
  assert.equal(run('pre-bash', bash(off, 'git commit --no-verify -m x')).output, undefined);
});

// Each sets a value in the git config, or runs a command through `-c`, which a sub-agent never does.
const CONFIG_SET = [
  'git config core.fsmonitor "touch planted; false"',
  'git -c core.pager=less-and-run log',
  'git -c alias.evil="!rm src/main.ts" evil',
  'git -c diff.odd.command=run diff',
  // Each changes the config by its verb or its flag, whatever the number of its operands.
  'git config set user.name builder',
  'git config edit',
  'git config --unset user.name',
  'git config --unset-all user.name',
  'git config --remove-section user',
  'git config --rename-section user person',
  'git config --edit',
  'git config --replace-all user.name x',
  'git config --add user.name x',
];

// Each only reads the config, or sets a value the sub-agent is allowed to leave alone.
const CONFIG_READ = [
  'git config --get user.name',
  'git config user.name',
  'git config --list',
  'git config get user.name',
  'git config list',
  'git -c user.name=guard commit --allow-empty -m x',
  'git log --oneline',
];

test('a sub-agent never sets the git config nor passes a dangerous -c, but reads it freely', () => {
  const root = project();
  const agent = worker(root);
  for (const command of CONFIG_SET) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /every checkout/, command);
  }
  for (const command of CONFIG_READ) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  // The main session sets its own config.
  assert.equal(run('pre-bash', bash(root, 'git config core.fsmonitor x')).output, undefined);
});

test('a core.fsmonitor planted in the config never runs on the git calls of the guard', () => {
  const root = committed();
  // The hook and its marker live under the git-ignored node_modules, so the work tree stays clean
  // and the guard reaches its own `git status` rather than running the project CLI first.
  const marker = join(root, 'node_modules', 'fsmonitor-ran');
  const hook = join(root, 'node_modules', 'fsmonitor.sh');
  writeFileSync(hook, `#!/bin/sh\ntouch "${marker}"\nexit 1\n`, { mode: 0o755 });
  git(root, 'config', 'core.fsmonitor', hook);
  run('stop', { cwd: root });
  assert.equal(existsSync(marker), false);
});

test('the hooks of the project and the steps of the conductor are read on the words of a command, however it is spelled', () => {
  const root = committed();
  for (const command of [
    "g''it commit --no-verify -m x",
    'g\\it commit --no-verify -m x',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x',
    'X=/dev/null git --config-env core.hooksPath=X commit -m x',
    'git am --no-verify x.patch',
    'git commit-tree HEAD^{tree} -m x',
    'LEFTHOOK_EXCLUDE=pre-commit git commit -m x',
  ]) {
    assert.match(reason(run('pre-bash', bash(root, command))), /hooks/, command);
  }
  const agent = worker(root, 'ordering');
  for (const command of [
    "npx ddd-ts-kit merge-trunk --to-la'nd'",
    "npx ddd-ts-kit acceptan'ce' us1 --lock",
    "npx ddd-ts-kit worker-sco'pe' billing",
    'git --no-pager merge -X theirs main',
    'git rebase -X theirs main',
    'git cherry-pick -X theirs main',
    'git merge --strategy-option theirs main',
    'git merge -s ours main',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
  }
  assert.equal(run('pre-bash', bash(root, 'echo LEFTHOOK=0 && git status')).output, undefined);
  assert.equal(run('pre-bash', bash(root, 'git merge main', agent)).output, undefined);
});
