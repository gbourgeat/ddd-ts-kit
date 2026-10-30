// The scope of a worker and the rules of the other sessions, wherever a file stands: what the editor
// tools and the shell may write from the checkout of the session, what a worker's git reaches, and what
// the guard says of a command or an answer it could not read in full.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  bash,
  cli,
  cliAnswering,
  committed,
  conductorWithWorker,
  decision,
  directory,
  edit,
  git,
  guardTemp,
  patchConfig,
  project,
  put,
  reason,
  run,
  worker,
  write,
} from './support.mjs';

const BUILDER = 'ddd-ts-kit:context-builder';
const TEST_WRITER = { agent_type: 'ddd-ts-kit:domain-test-writer' };

// The editor tools of a builder.

test('a pinned builder writes nowhere in the checkout of the conductor, by a path that forgot its worktree', () => {
  const { conductor, worktree, agent } = pinnedBuilder('forgot');
  git(conductor, 'checkout', '--quiet', '-b', 'conductor-branch');
  for (const path of [
    'src/main.ts',
    'src/platform/extra.ts',
    'package.json',
    'docs/notes.md',
    'src/contexts/ordering/CONTEXT.md',
    'src/contexts/billing/domain/invoice.ts',
    '.git/config',
    '.git/hooks/pre-commit',
    '.ddd-ts-kit/guard/state.json',
  ]) {
    const refused = run('pre-write', write(join(conductor, path), agent));
    assert.equal(decision(refused), 'deny', path);
    assert.match(reason(refused), new RegExp(`context "billing" in the worktree ${worktree}`), path);
    assert.match(reason(refused), /by its absolute path under your worktree/, path);
  }
  const edited = run('pre-write', edit(join(conductor, 'src/main.ts'), { from: 'a', to: 'b' }, agent));
  assert.equal(decision(edited), 'deny');
  const relative = run('pre-write', write('src/platform/extra.ts', agent));
  assert.equal(decision(relative), 'deny');
  assert.equal(
    run('pre-write', write(join(worktree, 'src/contexts/billing/CONTEXT.md'), agent)).output,
    undefined,
    'its own file by its absolute path',
  );
});

test('a pinned builder unwraps no acceptance outside its worktree', () => {
  const { conductor, agent } = pinnedBuilder('unwrapping');
  put(conductor, 'test/acceptance/us5.acceptance.spec.ts', "it('a', pending(async () => {}));\n");
  const refused = run(
    'pre-write',
    edit(
      join(conductor, 'test/acceptance/us5.acceptance.spec.ts'),
      { from: 'pending(async () => {})', to: 'async () => {}' },
      agent,
    ),
  );
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), /by its absolute path under your worktree/);
});

test('a pinned builder writes in no worktree but its own, with a scope file or without one', () => {
  const { conductor, agent } = pinnedBuilder('siblings');
  const story = join(conductor, '.worktrees', 'us5');
  git(conductor, 'worktree', 'add', '--quiet', '-b', 'story/us5', story);
  put(story, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US5' }));
  assert.equal(decision(run('pre-write', write(join(story, 'src/main.ts'), agent))), 'deny');
  const other = secondWorktree(conductor);
  const scoped = run('pre-write', write(join(other, 'src/contexts/shipping/CONTEXT.md'), agent));
  assert.match(reason(scoped), /is the worktree of another worker/);
});

test('the first write of a builder, before any pin, lands in no checkout without a scope', () => {
  const { conductor, worktree } = conductorWithWorker();
  const refused = run('pre-write', write(join(conductor, 'src/main.ts'), builder('first', conductor)));
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), /by its absolute path under the worktree of your briefing/);
  const named = run(
    'pre-write',
    write(join(conductor, 'src/main.ts'), { agent_type: 'context-builder', cwd: conductor }),
  );
  assert.equal(decision(named), 'deny');
  assert.equal(
    run('pre-write', write(join(worktree, 'src/contexts/billing/CONTEXT.md'), builder('first', conductor))).output,
    undefined,
  );
  // The conductor and the other agents keep their checkout.
  assert.equal(run('pre-write', write(join(conductor, 'docs/notes.md'), { cwd: conductor })).output, undefined);
  assert.equal(
    decision(run('pre-write', write(join(conductor, 'docs/notes.md'), { ...TEST_WRITER, cwd: conductor }))),
    'deny',
  );
});

test('a builder of a repository without a worker worktree is left alone, in advise mode the question is put', () => {
  const lone = committed();
  const unscoped = builder('unscoped', lone);
  assert.equal(run('pre-write', write(join(lone, 'docs/notes.md'), unscoped)).output, undefined);
  const { conductor } = conductorWithWorker();
  patchConfig(conductor, { guard: 'advise' });
  assert.equal(decision(run('pre-write', write(join(conductor, 'src/main.ts'), builder('asked', conductor)))), 'ask');
});

test('a builder writes outside every project only in the temp directory', () => {
  const { conductor, worktree, agent } = pinnedBuilder('elsewhere');
  const away = join(directory('away'), 'notes.md');
  const refused = run('pre-write', write(away, agent));
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), new RegExp(`outside every project.*${worktree}`));
  const first = builder('elsewhere-first', conductor);
  assert.equal(decision(run('pre-write', write(away, first))), 'deny');
  assert.equal(run('pre-write', write(join(guardTemp, 'n.md'), agent)).output, undefined);
  assert.equal(run('pre-write', write(away, { cwd: conductor })).output, undefined);
  assert.equal(
    run('pre-write', write(away, { ...agent, agent_id: 'never-seen', cwd: directory('none') })).output,
    undefined,
  );
  const lone = committed();
  assert.equal(run('pre-write', write(away, builder('lone', lone))).output, undefined);
  patchConfig(conductor, { guard: 'advise' });
  assert.equal(decision(run('pre-write', write(away, agent))), 'ask');
  patchConfig(conductor, { guard: 'off' });
  assert.equal(run('pre-write', write(away, agent)).output, undefined);
});

test('a builder pinned to a worktree is held from another project on the disk, and an agent of the project too', () => {
  const { conductor, worktree, agent } = pinnedBuilder('other-project');
  const other = project();
  const moved = run('pre-bash', bash(conductor, `cd ${other} && rm ${worktree}/src/main.ts`, agent));
  assert.equal(decision(moved), 'deny');
  assert.match(reason(moved), /Run it as `cd <worktree> && \.\.\.`/);
  const named = { agent_type: 'context-builder' };
  assert.equal(decision(run('pre-bash', bash(conductor, `echo x > ${worktree}/src/main.ts`, named))), 'deny');
});

// The shell rules of the other sessions.

test('the test writer is held to the paths of a test wherever the file stands', () => {
  const { conductor, worktree } = conductorWithWorker();
  const writer = { ...TEST_WRITER, cwd: conductor };
  for (const [command, expected] of [
    [`echo x > ${worktree}/src/main.ts`, /src\/main\.ts is production code/],
    [`cp /etc/hostname ${worktree}/src/main.ts`, /src\/main\.ts is production code/],
    [`rm ${worktree}/src/main.ts`, /src\/main\.ts is production code/],
    [`sed -i s/a/b/ ${worktree}/src/contexts/billing/domain/invoice.ts`, /invoice\.ts is production code/],
    [`cd ${worktree} && echo x > src/platform/test/helper.ts`, /src\/platform\/test\/helper\.ts is production code/],
    ['echo x > "$FILE"', /only to a file it names/],
    ['cd src; echo x > main.ts', /only to a file it names/],
    ['ls src | xargs rm', /only to a file it names/],
    ['rm "$FILE"', /only to a file it names/],
  ]) {
    const refused = run('pre-bash', bash(conductor, command, writer));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), expected, command);
  }
  for (const command of [
    `sed -i s/a/b/ ${worktree}/src/contexts/billing/test/unit/invoice.aggregate.spec.ts`,
    `echo x > ${worktree}/src/contexts/billing/test/worlds/billing.world.ts`,
    `echo x > ${worktree}/test/e2e/support/billing/world.ts`,
    `echo x > ${worktree}/src/platform/http/health.route.spec.ts`,
    'npm test -- billing > "$TMPDIR/billing.log" 2>&1',
    'echo x > /dev/null',
    `cat ${worktree}/src/main.ts`,
  ]) {
    assert.equal(run('pre-bash', bash(conductor, command, writer)).output, undefined, command);
  }
});

test('the story gate, the generated files and the baseline hold in a worktree named from the checkout of the session', () => {
  const { conductor, worktree } = conductorWithWorker();
  rmSync(join(worktree, '.ddd-ts-kit/worker.json'));
  put(worktree, '.ddd-ts-kit/story.json', JSON.stringify({ story: 'US5', base: 'main', branch: 'work/billing' }));
  put(worktree, 'docs/architecture/stories/US5.md', '# US5\n');
  for (const [command, expected] of [
    [
      `printf x > ${worktree}/src/contexts/ordering/domain/order-number.ts`,
      /The code of story US5 waits for its build gate/,
    ],
    [`cat /etc/hostname > ${worktree}/openapi/openapi.yaml`, /openapi\/openapi\.yaml is generated/],
    [`cp /etc/hostname ${worktree}/ddd-ts-kit-baseline.json`, /ddd-ts-kit-baseline\.json/],
  ]) {
    const refused = run('pre-bash', bash(conductor, command));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), expected, command);
  }
});

test('a project with the guard off is not judged from the checkout of another', () => {
  const root = project();
  const silent = project({ guard: 'off' });
  assert.equal(run('pre-bash', bash(root, `echo x > ${silent}/openapi/openapi.yaml`)).output, undefined);
});

test('the main checkout of the trunk refuses by the shell the code the editor tools refuse there', () => {
  const root = committed({ worktrees: 'required' });
  git(root, 'branch', '-M', 'main');
  for (const command of [
    'echo x > src/contexts/ordering/domain/order-number.ts',
    "sed -i '1i // note' src/contexts/ordering/domain/order.ts",
    'echo x | tee src/contexts/ordering/domain/order.ts',
  ]) {
    const refused = run('pre-bash', bash(root, command));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /main checkout of the trunk/, command);
  }
  assert.equal(run('pre-bash', bash(root, 'echo x >> src/contexts/ordering/CONTEXT.md')).output, undefined);
});

test('a new file of a generated role is refused by a redirection as it is by the editor tools', () => {
  const root = project();
  const refused = run('pre-bash', bash(root, 'echo x > src/contexts/ordering/domain/aggregates/thing.aggregate.ts'));
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), /npx ddd-ts-kit generate aggregate/);
});

// What a conductor runs every day stays free: what it puts back, moves or lays out in its checkout,
// and what it prepares in a worktree.
const CONDUCTOR_COMMANDS = [
  'git checkout --theirs openapi/openapi.yaml',
  'git checkout --ours -- openapi/openapi.yaml',
  'git checkout main -- docs/integration/asyncapi.yaml',
  'git restore openapi/openapi.yaml',
  'git rm openapi/openapi.yaml',
  'rm openapi/openapi.yaml',
  'git checkout -- src/contexts/ordering/domain/order.ts',
  'git restore src/contexts/ordering/domain/order.ts',
  'git rm src/contexts/ordering/domain/stray.ts',
  'rm src/contexts/ordering/domain/stray.ts',
  'git clean -fd src/contexts/ordering',
  'git mv src/contexts/ordering/domain/a.vo.ts src/contexts/ordering/domain/b.vo.ts',
  'mv src/contexts/ordering/domain/a.vo.ts src/contexts/ordering/domain/b.vo.ts',
  'npx @biomejs/biome format --write src/contexts/ordering/domain/order.ts',
  'npx eslint --fix src/contexts/ordering/domain',
  'git stash',
  'git reset --hard HEAD~1',
  'git merge --squash work/billing',
  'git worktree remove .worktrees/billing',
  'git worktree add .worktrees/shipping -b work/shipping',
  'rm -rf .worktrees/billing',
  'rm -rf .worktrees/billing/node_modules',
  'cp .env .worktrees/billing/.env',
  'cp -r node_modules .worktrees/billing/node_modules',
  'echo \'{"context":"billing"}\' > .worktrees/billing/.ddd-ts-kit/worker.json',
  'cd .worktrees/billing && git checkout -- openapi/openapi.yaml',
  'git -C .worktrees/billing checkout --theirs openapi/openapi.yaml',
  'git -C .worktrees/billing restore src/main.ts',
  "sed -i 's/todo/done/' docs/architecture/slices.md",
  'echo x >> docs/architecture/plan.md',
  'cat .worktrees/billing/.ddd-ts-kit/report.md',
  'echo x > "$FILE"',
  'cd src; echo x > notes.md',
  'npm run regenerate > "$TMPDIR/regenerate.log" 2>&1',
];

test('a conductor runs its ordinary commands, on the trunk with required worktrees, in its checkout and on a worktree', () => {
  const { conductor } = conductorWithWorker();
  patchConfig(conductor, { worktrees: 'required' });
  for (const command of CONDUCTOR_COMMANDS) {
    assert.equal(run('pre-bash', bash(conductor, command)).output, undefined, command);
  }
});

test('what puts a generated file back stays free, what writes it stays refused, and the baseline is held either way', () => {
  const root = project();
  for (const command of [
    'cp /etc/hostname openapi/openapi.yaml',
    'echo x > openapi/openapi.yaml',
    'mv x.yaml openapi/openapi.yaml',
  ]) {
    assert.match(reason(run('pre-bash', bash(root, command))), /openapi\/openapi\.yaml is generated/, command);
  }
  for (const command of ['rm ddd-ts-kit-baseline.json', 'git checkout HEAD~1 -- ddd-ts-kit-baseline.json']) {
    put(root, 'ddd-ts-kit-baseline.json', '{}');
    assert.match(reason(run('pre-bash', bash(root, command))), /ddd-ts-kit-baseline\.json/, command);
  }
});

// The baseline, on the words of the command.

const BASELINE_WRITES = [
  'npx ddd-ts-kit check --baseline write',
  'npx ddd-ts-kit check --baseline=write',
  'npx ddd-ts-kit@latest check --baseline write',
  'node node_modules/ddd-ts-kit/dist/bin.js check --baseline write',
  'npx ddd-ts-kit check --baseline "write"',
  "npx ddd-ts-kit check --baseline 'wr'ite",
  'npx ddd-ts-kit --cwd . check --baseline write',
  'npx ddd-ts-kit --cwd=. check --baseline write',
  'node scripts/kit.mjs check --baseline write',
  'npx ddd-ts-kit ch"eck" --baseline write',
  'node_modules/.bin/ddd-ts-kit check --baseline write',
  'pnpm exec ddd-ts-kit check --baseline write',
  'bash -c "npx ddd-ts-kit check --baseline write"',
  'npm run kit -- check --baseline write',
  'pnpm kit check --baseline write',
  'npm run adopt',
  'yarn run adopt',
];

const BASELINE_FREE = [
  'npx ddd-ts-kit check --baseline prune',
  'npx ddd-ts-kit check',
  'npm run kit -- check --baseline prune',
  'npm run missing -- check --baseline write',
  'npm run',
  'npm test',
  'git commit -m "docs: the owner runs ddd-ts-kit check --baseline write"',
  'grep -rn "check --baseline write" docs',
  'grep -rn "ddd-ts-kit check --baseline write" docs',
];

test('the baseline is written by no agent, through any launcher of the kit, its package scripts included', () => {
  const root = project();
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  manifest.scripts = { ...manifest.scripts, kit: 'ddd-ts-kit', adopt: 'ddd-ts-kit check --baseline write' };
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  for (const command of BASELINE_WRITES) {
    const refused = run('pre-bash', bash(root, command));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /check --baseline write records ddd-ts-kit-baseline\.json/, command);
  }
  for (const command of BASELINE_FREE) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
});

// What a worker's git reaches.

test('a worker lands nothing on the trunk and leaves the checkout of the conductor where it stands', () => {
  const { conductor, worktree, agent } = pinnedBuilder('landing');
  git(worktree, 'commit', '--quiet', '--allow-empty', '--no-verify', '--message', 'feat(billing): a slice');
  git(conductor, 'branch', 'other');
  for (const command of [
    `cd ${conductor} && git merge -q --ff-only work/billing`,
    `cd ${worktree} && git -C ${conductor} merge -q --ff-only work/billing`,
    `cd ${worktree} && git -C ../.. merge --ff-only work/billing`,
    `cd ${conductor} && git switch -q other`,
    `cd ${conductor} && git checkout other`,
    `cd ${conductor} && git rebase work/billing`,
    `cd ${conductor} && git cherry-pick work/billing`,
    `cd ${conductor} && git pull`,
    `cd ${conductor} && git commit --allow-empty -m x`,
    `cd ${conductor} && git add .`,
    `cd ${conductor} && git tag v1`,
    `cd ${conductor} && git stash pop`,
    `cd ${conductor} && git --git-dir=.git --work-tree=. merge work/billing`,
    'git add src/main.ts',
    'git merge work/billing',
    `cd "$WORKTREE" && git commit -m x`,
    `cd ${worktree}; git commit -m x`,
  ]) {
    const refused = run('pre-bash', bash(conductor, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /the conductor lands a branch/, command);
  }
  assert.match(reason(run('pre-bash', bash(conductor, 'git merge work/billing', agent))), /cd <worktree> && /);
});

test('a worker changes no sibling: its commits, its merges, its removal, its branch', () => {
  const { conductor, worktree, agent } = pinnedBuilder('siblings-git');
  const other = secondWorktree(conductor);
  for (const command of [`git -C ${other} commit --allow-empty -m x`, `git -C ${other} merge work/billing`]) {
    const refused = run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent));
    assert.match(reason(refused), new RegExp(`runs in ${other}`), command);
  }
  for (const command of [
    `git worktree remove --force ${other}`,
    'git worktree move ../shipping ../moved',
    'git worktree prune',
    'git update-ref -d refs/heads/work/shipping',
    'git update-ref refs/heads/main HEAD',
    'git symbolic-ref HEAD refs/heads/main',
    'git symbolic-ref --delete HEAD',
  ]) {
    const refused = run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /the worktrees and the refs of the repository are the conductor's/, command);
  }
  assert.equal(existsSync(other), true);
});

test('a bundled or shortened option of git branch rewrites a branch all the same', () => {
  const { conductor, worktree, agent } = pinnedBuilder('branch-options');
  secondWorktree(conductor);
  for (const command of [
    'git branch -fm work/shipping renamed',
    'git branch -Mf scratch work/shipping',
    'git branch --mov work/shipping renamed',
    'git branch --forc work/shipping HEAD',
    'git branch --del work/shipping',
    'git branch -dq work/shipping',
  ]) {
    const refused = run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent));
    assert.match(reason(refused), /never deletes, moves or resets the branch of another worktree/, command);
  }
  for (const command of [
    'git branch -vv',
    'git branch -av',
    'git branch --format=%(refname)',
    'git branch --no-merged main',
  ]) {
    assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent)).output, undefined, command);
  }
  assert.equal(run('pre-bash', bash(conductor, 'git branch --merged main', agent)).output, undefined);
});

// What a worker runs from the conductor's checkout to look around: a standing sub-agent starts there.
const GIT_READS_FROM_THE_CONDUCTOR = [
  'git status',
  'git log --oneline -5',
  'git diff --stat main',
  'git show HEAD',
  'git branch',
  'git branch -a',
  'git worktree list',
  'git rev-parse HEAD',
  'git rev-parse --show-toplevel',
  'git remote -v',
  'git remote show origin',
  'git stash list',
  'git stash show',
  'git tag',
  'git fetch origin',
  'git for-each-ref refs/heads',
  'git symbolic-ref HEAD',
  'git symbolic-ref --short HEAD',
  'git config --get user.name',
  'git --version',
  'git',
  'git -C .worktrees/billing status',
  'git -C .worktrees/billing log -1',
];

test('a worker reads git anywhere, and writes in its own worktree however it names it', () => {
  const { conductor, worktree, agent } = pinnedBuilder('reads');
  for (const command of GIT_READS_FROM_THE_CONDUCTOR) {
    assert.equal(run('pre-bash', bash(conductor, command, agent)).output, undefined, command);
  }
  for (const command of [
    `cd ${worktree} && git add src/contexts/billing`,
    `cd ${worktree} && git commit -m "feat(billing): a slice"`,
    `cd ${worktree}/src/contexts && git add .`,
    `cd ${worktree} && git merge main`,
    `git -C ${worktree} add src/contexts/billing`,
    `git -C ${worktree} commit -m "feat(billing): a slice"`,
    `cd ${worktree} && git worktree list`,
    `cd ${worktree} && git symbolic-ref HEAD`,
    `cd ${worktree} && git checkout -b work/billing-2`,
  ]) {
    assert.equal(run('pre-bash', bash(conductor, command, agent)).output, undefined, command);
  }
});

test('before its pin, a builder commits in a worktree that holds a scope, not in the conductor nor outside the repository', () => {
  const { conductor, worktree } = conductorWithWorker();
  const first = builder('before-the-pin', conductor);
  assert.equal(run('pre-bash', bash(conductor, `git -C ${worktree} add .`, first)).output, undefined);
  assert.match(reason(run('pre-bash', bash(conductor, 'git add .', first))), /the conductor lands a branch/);
  const away = directory('no-repository');
  assert.match(reason(run('pre-bash', bash(conductor, `git -C ${away} commit -m x`, first))), /runs in/);
});

test('a builder whose session stands above the project is held by the places its command names', () => {
  const { conductor, worktree } = conductorWithWorker();
  const above = dirname(conductor);
  const agent = builder('above', above);
  for (const command of [
    `echo x > ${worktree}/src/main.ts`,
    `rm ${worktree}/src/main.ts`,
    `cd ${worktree}; rm src/main.ts`,
  ]) {
    assert.equal(decision(run('pre-bash', bash(above, command, agent))), 'deny', command);
  }
  assert.equal(
    run('pre-bash', bash(above, `cd ${worktree} && echo x > src/contexts/billing/notes.md`, agent)).output,
    undefined,
  );
  assert.equal(run('pre-bash', bash(above, 'ls', agent)).output, undefined);
});

test('a builder standing in its worktree stays held to it when a command starts in another project', () => {
  const { worktree } = conductorWithWorker();
  const other = project();
  for (const [name, command] of [
    ['first-other', `cd ${other} && rm ${worktree}/src/main.ts`],
    ['option-other', `echo --cwd=${other} ; rm src/main.ts`],
  ]) {
    assert.equal(decision(run('pre-bash', bash(worktree, command, builder(name, worktree)))), 'deny', command);
  }
});

test('from the checkout of the conductor a builder reads, and whatever writes goes through its worktree', () => {
  const { conductor, worktree, agent } = pinnedBuilder('any-program');
  for (const command of [
    `sort -o ${worktree}/src/main.ts /etc/hostname`,
    `mkdir ${worktree}/src/platform/extra`,
    `chmod 000 ${worktree}/src/main.ts`,
    `git -C ${worktree} merge main`,
    `git -C ${worktree} reset HEAD~1`,
    `git -C ${worktree} rebase main`,
    `git -C ${worktree} pull`,
    `cd ${worktree}; sort -o src/main.ts /etc/hostname`,
    'npx ddd-ts-kit check --baseline prune',
  ]) {
    const refused = run('pre-bash', bash(conductor, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /cd <worktree> && \.\.\./, command);
  }
  for (const command of [
    `ls ${worktree}/src`,
    `cat ${worktree}/package.json`,
    `git -C ${worktree} status`,
    'npx ddd-ts-kit list',
    'npx ddd-ts-kit worker-scope billing --dry-run',
    'npx ddd-ts-kit status --workers',
  ]) {
    assert.equal(run('pre-bash', bash(conductor, command, agent)).output, undefined, command);
  }
});

test('a builder without a scope in a repository without one, and the other agents, keep their git', () => {
  const lone = committed();
  const unscoped = builder('lone-git', lone);
  assert.equal(run('pre-bash', bash(lone, 'git add .', unscoped)).output, undefined);
  const { conductor } = conductorWithWorker();
  assert.equal(run('pre-bash', bash(conductor, 'git merge --squash work/billing')).output, undefined);
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  assert.equal(run('pre-bash', bash(conductor, 'git add .', reviewer)).output, undefined);
});

test('git read through its options names its subcommand: a value of an option is no subcommand', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'git --namespace x config core.pager cat',
    'git --git-dir .git config core.pager cat',
    'git --work-tree . config core.pager cat',
  ]) {
    assert.match(
      reason(run('pre-bash', bash(root, command, agent))),
      /`git config` changes the git configuration/,
      command,
    );
  }
});

// A locked regression spec, by what holds it.

const LOCKED_FOLDER = 'src/contexts/ordering/test/unit';
const LOCKED_SPEC = `${LOCKED_FOLDER}/order.aggregate.spec.ts`;

const FOLDER_WRITES = [
  `rm -rf ${LOCKED_FOLDER}`,
  `git rm -r ${LOCKED_FOLDER}`,
  `mv ${LOCKED_FOLDER} /tmp/kept`,
  'rm -rf src/contexts/ordering',
  `cp /tmp/kept/*.ts ${LOCKED_FOLDER}/`,
  `git checkout HEAD -- ${LOCKED_FOLDER}`,
  `find ${LOCKED_FOLDER} -name '*.ts' -exec sed -i s/refused/cancelled/ {} +`,
  `find ${LOCKED_FOLDER} -name '*.ts' -delete`,
  `find ${LOCKED_FOLDER} -name '*.ts' -exec ./tools/rewrite.sh {} +`,
  "find src/contexts/ordering -name '*.ts' -exec sed -i s/Order/Purchase/g {} +",
  `find ${LOCKED_FOLDER} -exec sh -c 'sed -i s/a/b/ "$0"' {} \\;`,
];

const UNNAMED_WRITES = [
  `ls ${LOCKED_FOLDER}/*.ts | xargs sed -i s/refused/cancelled/`,
  'rg -l Order src | xargs sed -i s/Order/Purchase/g',
  `cd ${LOCKED_FOLDER}; sed -i s/refused/cancelled/ o*.ts`,
  `d=${LOCKED_FOLDER}; sed -i s/refused/cancelled/ $d/*.ts`,
  'cd src/contexts/ordering; rm -rf test',
];

test('a folder that holds a locked regression spec counts as the spec, to a sub-agent', () => {
  const root = lockedFix();
  for (const agent of [{ agent_type: BUILDER }, TEST_WRITER]) {
    for (const command of FOLDER_WRITES) {
      const held = run('pre-bash', bash(root, command, agent));
      assert.equal(decision(held), 'deny', command);
      assert.match(reason(held), /is a regression spec of fix FIX-412, locked/, command);
    }
    for (const command of UNNAMED_WRITES) {
      const held = run('pre-bash', bash(root, command, agent));
      assert.equal(decision(held), 'deny', command);
      assert.match(reason(held), /places only the shell knows/, command);
    }
  }
});

test('a sub-agent of a fix reads through find and xargs, and writes what holds no locked spec', () => {
  const root = lockedFix();
  for (const agent of [{ agent_type: BUILDER }, TEST_WRITER]) {
    for (const command of [
      `find ${LOCKED_FOLDER} -name '*.ts'`,
      'find . -name order.aggregate.spec.ts',
      `find ${LOCKED_FOLDER} -name '*.ts' -exec grep -l refused {} +`,
      `find ${LOCKED_FOLDER} -name '*.ts' -exec stat {} +`,
      `ls ${LOCKED_FOLDER}/*.ts | xargs wc -l`,
      'git ls-files src | xargs grep -l Order',
      `npx vitest run ${LOCKED_FOLDER}`,
      `grep -rn refused ${LOCKED_FOLDER}`,
    ]) {
      assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
    }
  }
  const builderAgent = { agent_type: BUILDER };
  for (const command of [
    "find src/contexts/ordering/domain -name '*.ts' -exec sed -i s/Order/Purchase/g {} +",
    'sed -i s/a/b/ src/contexts/ordering/domain/other.ts',
    'rm src/contexts/ordering/domain/other.ts',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, builderAgent)).output, undefined, command);
  }
  // The session of the fix writes a new version: nothing of this is refused to it.
  for (const command of [`rm -rf ${LOCKED_FOLDER}`, `ls ${LOCKED_FOLDER}/*.ts | xargs sed -i s/a/b/`]) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
});

test('a locked regression spec is held by the project that owns it, from the checkout of the session', () => {
  const root = lockedFix();
  const session = project();
  const held = run('pre-bash', bash(session, `sed -i s/a/b/ ${join(root, LOCKED_SPEC)}`, TEST_WRITER));
  assert.equal(decision(held), 'deny');
  assert.match(reason(held), /is a regression spec of fix FIX-412, locked/);
});

// A command the reader cannot read to its end.

const UNFINISHED_LINES = [
  ['cat <<EOF\nbody\nrm src/main.ts\n', /never closes/],
  ['cat <<EOF', /never closes/],
  ['cat <<-EOF\n\tbody\n', /never closes/],
  ["echo 'an open quote ; rm src/main.ts", /never closes/],
  ['echo "an open quote ; rm src/main.ts', /never closes/],
  ['echo $(rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['echo `rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['echo "$(rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['echo $(echo unread', /never closes/],
  ['echo `echo unread', /never closes/],
  ["echo $'an open quote", /never closes/],
  ["echo $(echo 'an open quote)", /never closes/],
  ['((x=1<<2))\nrm src/main.ts\n', /never closes/],
];

test('a here-document that never closes, or a line that ends inside a quote, is refused to a worker and to it alone', () => {
  const root = project();
  const agent = worker(root);
  for (const [command, expected] of UNFINISHED_LINES) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), expected, command);
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
});

test('a builder from the conductor is refused a line it cannot read, as it is a write', () => {
  const { conductor, worktree } = conductorWithWorker();
  const refused = run(
    'pre-bash',
    bash(conductor, `cat <<EOF\necho x > ${worktree}/src/main.ts\n`, builder('open', conductor)),
  );
  assert.match(reason(refused), /Run it as `cd <worktree> && \.\.\.`/);
});

// What an honest worker writes that a reader in a hurry would take for an open quote.
const CLOSED_LINES = [
  "git commit -m \"$(cat <<'EOF'\nfeat(ordering): don't refuse a paid order\n\n1) first\n2) second\nEOF\n)\"",
  'git commit -m "$(cat <<EOF\nfix(ordering): it\'s closed\nEOF\n)" && git log --oneline -1',
  "git commit -F - <<'EOF'\nfeat(ordering): don't refuse\nEOF",
  "gh pr create --body \"$(cat <<-'EOF'\n\tit's fine\n\tEOF\n)\"",
  "VALUE=$(cat <<'EOF'\nit's a value\nEOF\n); echo \"$VALUE\"",
  "cat <<'ONE' <<'TWO'\nit's one\nONE\nit's two\nTWO",
  "git log --format=$'%H\\t%s' -1",
  "echo $'it\\'s closed'",
  "echo \"$(echo $'it\\'s')\"",
  'echo $((1<<2))',
  'echo "$((1 << 2))"',
  'echo $(( $(wc -l < README.md) + 1 ))',
  'echo "$(cat README.md # it\'s a comment\n)"',
  'cat <<< "a here-string"',
  'echo "$(cat <<< \'a here-string\')"',
  "# it's a comment\ngit status",
  "git status # it's a comment",
  'echo "it\'s closed"',
  "python3 - <<'PY'\nprint(\"it's fine\")\nPY",
];

test('a line that closes each of its quotes and here-documents passes, an apostrophe inside them included', () => {
  const root = project();
  const agent = worker(root);
  for (const command of CLOSED_LINES) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('the commands after a here-document inside a substitution are still read', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    "echo \"$(cat <<'EOF'\nit's a body)\nEOF\n)\"; rm src/main.ts",
    'VALUE=$(cat <<EOF\n1) a body\nEOF\n)\nrm src/main.ts',
    "echo $(cat <<'A' <<'B'\nit's\nA\nit's\nB\n); rm src/main.ts",
    "echo $(rm src/main.ts # it's a comment\n)",
    "echo $(echo $'it\\'s'; rm src/main.ts)",
    'echo $(( $(rm src/main.ts) + 1 ))',
    "cat <<$'E'\nbody\nE\nrm src/main.ts\n",
    "echo $'\\'' ; rm src/main.ts ; echo '\\'''",
  ]) {
    assert.match(reason(run('pre-bash', bash(root, command, agent))), /`rm` changes src\/main\.ts/, command);
  }
});

test('a place spelled in an ANSI-C quote is that place, and one with an escape is known to the shell alone', () => {
  const root = project();
  const agent = worker(root);
  assert.match(reason(run('pre-bash', bash(root, "rm $'src/main.ts'", agent))), /`rm` changes src\/main\.ts/);
  assert.match(reason(run('pre-bash', bash(root, "rm $'src/\\x6dain.ts'", agent))), /files only the shell knows/);
});

// A line of more commands than the reader can hold: it stops with an error of the runtime.
const TOO_LONG = `bash -c "${'true;'.repeat(200_000)}"; rm src/main.ts`;

test('a command the reader breaks on is refused to a worker, and left to the checks of the pipeline for the others', () => {
  const root = project();
  const agent = worker(root);
  const refused = run('pre-bash', bash(root, TOO_LONG, agent));
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), /could not read this command/);
  assert.equal(run('pre-bash', bash(root, TOO_LONG)).output, undefined);
  const { conductor } = conductorWithWorker();
  assert.match(
    reason(run('pre-bash', bash(conductor, TOO_LONG, builder('long', conductor)))),
    /could not read this command/,
  );
  assert.equal(run('pre-bash', bash(project(), TOO_LONG, { agent_type: BUILDER })).output, undefined);
});

test('a target option given last, or joined to its value, is read', () => {
  const root = project();
  const agent = worker(root);
  for (const [command, expected] of [
    ['rm src/main.ts; mv -t', /`rm` changes src\/main\.ts/],
    ['cp a -t 2>/dev/null; echo x > src/main.ts', /`cp` changes files only the shell knows/],
    ['mv -t 2>/dev/null; rm src/main.ts', /`mv` changes files only the shell knows/],
    ['cp -tsrc/platform /etc/hostname', /`cp` changes src\/platform/],
    ['mv -tsrc/platform src/contexts/ordering/a.ts', /`mv` changes src\/platform/],
    ['mv --target-directory=src/platform src/contexts/ordering/a.ts', /`mv` changes src\/platform/],
    ['ln -tsrc/platform src/contexts/ordering/a.ts', /`ln` changes src\/platform/],
  ]) {
    assert.match(reason(run('pre-bash', bash(root, command, agent))), expected, command);
  }
  // The stamp of `touch -t` is no target.
  assert.equal(
    run('pre-bash', bash(root, 'touch -t 202001010000 src/contexts/ordering/notes.md', agent)).output,
    undefined,
  );
});

// What a worker's last command and its background commands leave.

test('what a command in the background changes outside the scope after a read is held at the next call', () => {
  const { conductor, worktree, agent } = pinnedBuilder('background');
  const started = `cd ${worktree} && (npm run dev &)`;
  assert.equal(run('pre-bash', bash(conductor, started, agent)).output, undefined);
  const read = `cd ${worktree} && git status`;
  assert.equal(run('pre-bash', bash(conductor, read, agent)).output, undefined);
  assert.equal(run('pre-bash', bash(conductor, read, agent)).output, undefined);
  rmSync(join(worktree, 'src/main.ts'));
  const stopped = run('pre-bash', bash(conductor, read, agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /changed files outside your scope: src\/main\.ts/);
  assert.equal(
    decision(run('pre-write', write(join(worktree, 'src/contexts/billing/CONTEXT.md'), agent))),
    'deny',
    'the editor tools are held too',
  );
});

test('a read keeps the note for the worktree only: a later change of the checkout of the session is not charged to the worker', () => {
  const { conductor, worktree, agent } = pinnedBuilder('kept-note');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent)).output, undefined);
  put(conductor, 'docs/notes.md', 'Notes of the conductor.\n');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent)).output, undefined);
});

test('a write of the worker in its scope keeps the note of its last command', () => {
  const { conductor, worktree, agent } = pinnedBuilder('write-keeps');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  const scoped = join(worktree, 'src/contexts/billing/CONTEXT.md');
  assert.equal(run('pre-write', write(scoped, agent)).output, undefined);
  rmSync(join(worktree, 'src/main.ts'));
  assert.equal(decision(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent))), 'deny');
});

test('what the last command of a worker changed outside its scope keeps it going once, and reaches the conductor', () => {
  const { conductor, worktree, agent } = pinnedBuilder('last-command');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  rmSync(join(worktree, 'src/main.ts'));
  const stopping = { ...agent, last_assistant_message: 'The slice is done.' };
  const kept = run('subagent-stop', stopping);
  assert.equal(kept.output.decision, 'block');
  assert.match(kept.output.reason, /changed files outside your scope: src\/main\.ts/);
  assert.match(kept.output.reason, /`git checkout HEAD -- src\/main\.ts`/);
  assert.equal(existsSync(join(conductor, '.ddd-ts-kit/guard', `scope-${stateKey(agent)}.json`)), true);

  // It ended without putting the file back: the stop lets it go, and each place the conductor reads says it.
  const ended = run('subagent-stop', stopping);
  assert.equal(ended.output.decision, undefined);
  assert.match(ended.output.systemMessage, /changed files outside your scope: src\/main\.ts/);
  const record = JSON.parse(readFileSync(join(worktree, '.ddd-ts-kit/agent.json'), 'utf8'));
  assert.match(record.lastStop.outside, /changed files outside your scope: src\/main\.ts/);
  const report = readFileSync(join(worktree, '.ddd-ts-kit/report.md'), 'utf8');
  assert.match(report, /^The slice is done\./);
  assert.match(report, /The guard at the stop: .*src\/main\.ts/);
});

test('a worker that puts the file back at the stop ends clean', () => {
  const { conductor, worktree, agent } = pinnedBuilder('puts-back');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  rmSync(join(worktree, 'src/main.ts'));
  assert.equal(run('subagent-stop', agent).output.decision, 'block');
  git(worktree, 'checkout', 'HEAD', '--', 'src/main.ts');
  assert.equal(run('subagent-stop', agent).output, undefined);
  const record = JSON.parse(readFileSync(join(worktree, '.ddd-ts-kit/agent.json'), 'utf8'));
  assert.equal(record.lastStop.outside, undefined);
});

test('a last command that changed nothing outside the scope, in the session or in the packages, stops quietly', () => {
  const { conductor, worktree, agent } = pinnedBuilder('quiet');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  assert.equal(run('subagent-stop', agent).output, undefined);
  put(worktree, 'src/contexts/billing/notes.md', 'A note.\n');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  put(worktree, 'src/contexts/billing/notes.md', 'A second note.\n');
  assert.equal(run('subagent-stop', agent).output, undefined);
});

test('what the last command changed in the checkout of the session is said at the stop', () => {
  const { conductor, worktree, agent } = pinnedBuilder('session-at-stop');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  put(conductor, 'src/platform/extra.ts', 'export const extra = 1;\n');
  const told = run('subagent-stop', agent);
  assert.equal(told.output.decision, 'block');
  assert.match(
    told.output.reason,
    /checkout of the session, .* changed while your last command ran: src\/platform\/extra\.ts/,
  );
});

test('what a sanctioned script rewrote as the last command is said at the stop too', () => {
  const { conductor, worktree, agent } = pinnedBuilder('script-at-stop');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm run format`, agent)).output, undefined);
  put(worktree, 'src/main.ts', 'export {};\n');
  const told = run('subagent-stop', agent);
  assert.match(told.output.reason, /`npm run format` rewrote files outside your scope: src\/main\.ts/);
});

test('a builder whose worktree or scope is gone at the stop is compared with nothing', () => {
  const { conductor, worktree, agent } = pinnedBuilder('gone');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  rmSync(worktree, { recursive: true, force: true });
  assert.equal(run('subagent-stop', agent).output, undefined);
  const fresh = conductorWithWorker();
  const unseen = builder('unseen', fresh.conductor);
  assert.equal(run('subagent-stop', unseen).output, undefined);
});

test('a slice left uncommitted and a change outside the scope are both told to the worker at its stop', () => {
  const { conductor, worktree, agent } = pinnedBuilder('both');
  put(worktree, 'src/contexts/billing/notes.md', 'A note.\n');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: worktree, encoding: 'utf8' }).stdout.trim();
  put(
    worktree,
    '.ddd-ts-kit/verification.json',
    JSON.stringify({ ok: true, head, at: new Date(Date.now() + 60_000).toISOString() }),
  );
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  rmSync(join(worktree, 'src/main.ts'));
  const told = run('subagent-stop', agent);
  assert.match(told.output.reason, /verify-slice passed but the slice is not committed/);
  assert.match(told.output.reason, /changed files outside your scope: src\/main\.ts/);
});

// An answer past what the guard reads.

test('a check that answers more than a megabyte is read, and its errors stop the session', () => {
  const root = committed();
  const violations = Array.from({ length: 6000 }, (_, index) => ({
    ruleId: 'layer/domain-purity',
    severity: 'error',
    file: `src/contexts/ordering/domain/file-${index}.ts`,
    line: 1,
    message: 'x'.repeat(200),
    fix: 'y'.repeat(60),
  }));
  cliAnswering(root, { check: { ok: false, violations } });
  writeFileSync(join(root, 'README.md'), 'Changed.\n');
  const stopped = run('stop', { cwd: root, stop_hook_active: false });
  assert.equal(stopped.output.decision, 'block');
  assert.match(stopped.output.reason, /6000 architecture error\(s\) remain/);
});

test('a check that answers more than the guard reads lets the session finish and says so', () => {
  const root = committed();
  const bin = join(root, 'node_modules/ddd-ts-kit/bin.mjs');
  writeFileSync(
    bin,
    "#!/usr/bin/env node\nprocess.stdout.write('{\"violations\":[', () => process.stdout.write('x'.repeat(70 * 1024 * 1024)));\n",
  );
  writeFileSync(join(root, 'README.md'), 'Changed.\n');
  const stopped = run('stop', { cwd: root, stop_hook_active: false });
  assert.equal(stopped.output.decision, undefined);
  assert.match(stopped.output.systemMessage, /architecture check answered more than the guard reads/);
  assert.match(stopped.output.systemMessage, /npx ddd-ts-kit check/);
});

test('a status of more than a megabyte is compared, what changed in it stops the worker', () => {
  const root = committed();
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.ddd-ts-kit/\n');
  const folder = join(root, 'dist-like');
  mkdirSync(folder);
  for (let index = 0; index < 7000; index += 1) {
    writeFileSync(join(folder, `${String(index).padStart(6, '0')}-${'x'.repeat(190)}.txt`), '');
  }
  const agent = { ...worker(root, 'ordering'), session_id: 'large', agent_id: 'builder-1' };
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  rmSync(join(root, 'src/main.ts'));
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /changed files outside your scope:.*src\/main\.ts/);
});

test('a status past what the guard reads is said, on the side of the note or of the comparison, and holds nothing', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'cut', agent_id: 'builder-1' };
  const marker = join(root, '.ddd-ts-kit/cut');
  const env = gitAnsweringTooMuch(marker, '');
  // The note could not be read.
  put(root, '.ddd-ts-kit/cut', '');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent), env).output, undefined);
  rmSync(marker);
  const after = run('pre-bash', bash(root, 'git status', agent), env);
  assert.equal(decision(after), undefined);
  assert.match(after.output.hookSpecificOutput.additionalContext, /was not compared/);
  // The comparison could not be read.
  assert.equal(run('pre-bash', bash(root, 'npm test', agent), env).output, undefined);
  put(root, '.ddd-ts-kit/cut', '');
  const cut = run('pre-bash', bash(root, 'git status', agent), env);
  assert.match(cut.output.hookSpecificOutput.additionalContext, /was not compared/);
  rmSync(marker);
  // A file held waits for a status that can be read.
  assert.equal(run('pre-bash', bash(root, 'npm test', agent), env).output, undefined);
  writeFileSync(join(root, 'package.json'), '{}\n');
  assert.equal(decision(run('pre-bash', bash(root, 'git status', agent), env)), 'deny');
  put(root, '.ddd-ts-kit/cut', '');
  assert.equal(decision(run('pre-bash', bash(root, 'git status', agent), env)), undefined);
  rmSync(marker);
  assert.equal(decision(run('pre-bash', bash(root, 'git status', agent), env)), 'deny');
});

test('a status of the session past what the guard reads at the note says nothing of the files of the session', () => {
  const { conductor, worktree, agent } = pinnedBuilder('cut-session');
  const marker = join(conductor, '.ddd-ts-kit/cut');
  const env = gitAnsweringTooMuch(marker, conductor);
  put(conductor, 'docs/notes.md', 'Notes of the conductor.\n');
  put(conductor, '.ddd-ts-kit/cut', '');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent), env).output, undefined);
  rmSync(marker);
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent), env).output, undefined);
});

function builder(name, cwd, extra = {}) {
  return { agent_type: BUILDER, session_id: 'scope', agent_id: name, cwd, ...extra };
}

// A builder of the conductor, its worktree pinned by a first command there.
function pinnedBuilder(name) {
  const fixture = conductorWithWorker();
  const agent = builder(name, fixture.conductor);
  assert.equal(
    run('pre-bash', bash(fixture.conductor, `cd ${fixture.worktree} && git status`, agent)).output,
    undefined,
  );
  return { ...fixture, agent };
}

function secondWorktree(conductor, name = 'shipping') {
  const other = join(conductor, '.worktrees', name);
  git(conductor, 'worktree', 'add', '--quiet', '-b', `work/${name}`, other);
  put(other, '.ddd-ts-kit/worker.json', JSON.stringify({ context: name }));
  return other;
}

function lockedFix() {
  const root = project();
  put(
    root,
    '.ddd-ts-kit/story.json',
    JSON.stringify({ story: 'FIX-412', base: 'main', branch: 'fix/412', kind: 'fix' }),
  );
  put(
    root,
    'docs/architecture/stories/FIX-412.md',
    `# FIX-412\n\n## Statement\n\nA shipped order is cancelled.\n\n## Regression\n\n- ${LOCKED_SPEC}\n`,
  );
  put(root, LOCKED_SPEC, "import { it } from 'vitest';\n\nit('#FIX-412 refuses', () => {});\n");
  put(root, 'src/contexts/ordering/domain/other.ts', 'export {};\n');
  const locked = spawnSync('node', [cli, 'acceptance', 'FIX-412', '--lock'], { cwd: root, encoding: 'utf8' });
  assert.equal(locked.status, 0, locked.stderr);
  return root;
}

function stateKey(input) {
  return createHash('sha256')
    .update(`${input.session_id ?? ''}\0${input.agent_id ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

// A git that answers `status` with more than the guard reads, in the folder named, while its marker stands.
function gitAnsweringTooMuch(marker, folder) {
  const bin = directory('bin');
  const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(
    join(bin, 'git'),
    `#!/bin/sh
case "$*" in
  *"status --porcelain=v2"*)
    if [ -e "${marker}" ] && { [ -z "${folder}" ] || [ "$PWD" = "${folder}" ]; }; then
      head -c 70000000 /dev/zero
      exit 0
    fi;;
esac
exec "${real}" "$@"
`,
  );
  chmodSync(join(bin, 'git'), 0o755);
  return { PATH: `${bin}:${process.env.PATH}` };
}
