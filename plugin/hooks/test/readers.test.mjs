// What the guard counts as a command that only reads: a reader named by its path, git given a
// setting or an option that runs a program, and the kit named among the words of another program
// all run code, so the state outside a worker's scope is noted before them.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, reason, run, worker } from './support.mjs';

test('a program named like a reader but by its path, and git asked to run a program, are noted before they run', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'readers', agent_id: 'noted' };
  for (const command of [
    './src/contexts/ordering/tools/cat notes.md',
    "git grep -O'sh -c x' -l createApp",
    'git grep --open-files-in-pager=less -l createApp',
    'git diff --ext-diff',
    'git log -p --ext-diff',
    `node -e "console.log(1)" ddd-ts-kit merge-trunk`,
    'node -e "console.log(1)" node_modules/ddd-ts-kit/dist/bin.js status',
  ]) {
    rmSync(join(root, '.ddd-ts-kit/guard'), { recursive: true, force: true });
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
    assert.equal(noted(root, agent), true, command);
  }
  for (const command of [
    'cat notes.md',
    'git diff',
    'git log -p',
    'git grep -l createApp',
    'npx ddd-ts-kit merge-trunk',
  ]) {
    rmSync(join(root, '.ddd-ts-kit/guard'), { recursive: true, force: true });
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
    assert.equal(noted(root, agent), false, command);
  }
});

// A setting of git that runs a program, given to one command by an option or by the environment.
const SETTINGS_THAT_RUN_A_PROGRAM = [
  'git -c diff.external=./x diff',
  'git -c include.path=/tmp/x status',
  'git -c includeIf.onbranch:main.path=/tmp/x status',
  'git -c core.attributesFile=/tmp/x status',
  'git -c core.gitProxy=./x fetch',
  'git -c core.askPass=./x fetch',
  "git -c credential.helper='!./x' fetch",
  'git -c sequence.editor=./x rebase -i HEAD~1',
  'git -c interactive.diffFilter=./x add -p',
  'git -c pager.status=./x status',
  'git -c mergetool.x.cmd=./x mergetool',
  'git -c difftool.x.cmd=./x difftool',
  'git -c gpg.ssh.program=./x commit -S -m x',
  'git -c protocol.ext.allow=always fetch',
  'git -c diff.x.textconv=./x diff',
  'git -c merge.x.driver=./x merge main',
  'X=./x git --config-env=core.fsmonitor=X status',
  'X=./x git --config-env core.pager=X log',
  'GIT_EXTERNAL_DIFF=./x git diff',
  'GIT_PAGER=./x git log',
  'GIT_EDITOR=./x git commit',
  'GIT_SEQUENCE_EDITOR=./x git rebase -i HEAD~1',
  'GIT_SSH_COMMAND=./x git fetch',
  'GIT_CONFIG_PARAMETERS="\'core.fsmonitor=./x\'" git status',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.pager GIT_CONFIG_VALUE_0=./x git log',
  'env GIT_PAGER=./x git log',
  'export GIT_PAGER=./x; git log',
];

test('a sub-agent sets no git setting that runs a program, by an option or by the environment', () => {
  const root = committed();
  const agent = worker(root, 'ordering');
  for (const command of SETTINGS_THAT_RUN_A_PROGRAM) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /runs a command|a program/, command);
  }
  for (const command of ['git -c color.ui=always status', 'GIT_TRACE=1 git status', 'git log --oneline']) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

// The note a worker's command leaves before it runs, in the guard's folder of its worktree.
function noted(root, input) {
  const key = createHash('sha256')
    .update(`${input.session_id ?? ''}\0${input.agent_id ?? ''}`)
    .digest('hex')
    .slice(0, 16);
  return existsSync(join(root, '.ddd-ts-kit/guard', `before-run-${key}.json`));
}
