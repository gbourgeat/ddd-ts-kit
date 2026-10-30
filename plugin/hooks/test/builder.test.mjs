// The runs of a context-builder agent: its calls counted, its two notices, its run and its report recorded in
// its worktree.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { limitOf } from '../builder-runs.mjs';
import {
  bash,
  committed,
  conductorWithWorker,
  decision,
  directory,
  git,
  guard,
  guardTemp,
  here,
  project,
  put,
  reason,
  run,
  runFrom,
  worker,
  write,
} from './support.mjs';

// The runs of a context-builder: its tool calls counted inside pre-bash and pre-write, two notices
// before its turn limit, its run recorded in its worktree, its stop checked.
const LIMIT = limitOf();
// The calibration of builder-runs.mjs: a quarter of the calls uncounted for the first, a sixth for the second.
const FIRST_NOTICE = Math.floor((LIMIT - 30) * 0.75);
const SECOND_NOTICE = Math.floor((LIMIT - 12) * 0.85);

test('a context-builder is warned once before its turn limit, counted from its shell and its writes', () => {
  const root = committed();
  worker(root);
  const agent = builder('counted');
  const notices = [];
  for (let call = 1; call <= FIRST_NOTICE; call += 1) {
    const result =
      call % 3 === 0
        ? run('pre-write', { cwd: root, ...write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent) })
        : run('pre-bash', bash(root, 'git status', agent));
    if (noticeOf(result)) {
      notices.push([call, noticeOf(result)]);
    }
  }
  assert.equal(notices.length, 1);
  assert.equal(notices[0][0], FIRST_NOTICE);
  assert.match(notices[0][1], /^ddd-ts-kit: your turn limit is near .* start no other one/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', agent))), undefined);
});

function noticeOf(result) {
  return result.output?.hookSpecificOutput?.additionalContext;
}

function builder(id, extra = {}) {
  return {
    agent_type: 'ddd-ts-kit:context-builder',
    agent_id: id,
    session_id: 'conductor',
    ...extra,
  };
}

test('the second notice comes once at its threshold, and rides along a refusal', () => {
  const root = committed();
  worker(root);
  const agent = builder('second');
  seed(root, agent, { run: 1, calls: SECOND_NOTICE - 1, notices: ['first'], startedAt: now() });
  const refused = run('pre-bash', bash(root, 'npm i zod', agent));
  assert.equal(decision(refused), 'deny');
  assert.match(noticeOf(refused), /^ddd-ts-kit: your turn limit is close .* Stop changing code/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', agent))), undefined);
  // Crossing both thresholds at once says only the second.
  const late = builder('late');
  seed(root, late, { run: 1, calls: SECOND_NOTICE + 5, notices: [], startedAt: now() });
  assert.match(noticeOf(run('pre-bash', bash(root, 'git status', late))), /turn limit is close/);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', late))), undefined);
});

function now() {
  return new Date().toISOString();
}

function seed(root, input, state) {
  return put(root, runState(input), JSON.stringify(state));
}

function runState(input) {
  return `.ddd-ts-kit/guard/turns-${stateKey(input)}.json`;
}

function stateKey(input) {
  return createHash('sha256')
    .update(`${input.session_id ?? ''}\0${input.agent_id ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

test('two builders are counted apart, and a new run of one starts its count again', () => {
  const root = committed();
  worker(root);
  const [first, second] = [builder('first'), builder('second')];
  seed(root, first, { run: 1, calls: FIRST_NOTICE - 1, notices: [], startedAt: now() });
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', second))), undefined);
  assert.match(noticeOf(run('pre-bash', bash(root, 'git status', first))), /turn limit is near/);
  assert.equal(run('subagent-start', { cwd: root, ...first }).output, undefined);
  const restarted = JSON.parse(readFileSync(join(root, runState(first)), 'utf8'));
  assert.equal(restarted.run, 2);
  assert.equal(restarted.calls, 0);
  assert.deepEqual(restarted.notices, []);
  assert.equal(noticeOf(run('pre-bash', bash(root, 'git status', first))), undefined);
  assert.equal(agentFile(root).run, 2);
});

function agentFile(root) {
  return JSON.parse(readFileSync(join(root, '.ddd-ts-kit', 'agent.json'), 'utf8'));
}

test('the main session and the other agents are neither counted nor warned', () => {
  const root = committed();
  worker(root);
  const others = [
    { session_id: 'conductor' },
    { session_id: 'conductor', agent_id: 'reviewer', agent_type: 'ddd-ts-kit:architecture-reviewer' },
  ];
  for (const input of others) {
    seed(root, input, { run: 1, calls: FIRST_NOTICE - 1, notices: [] });
    assert.equal(run('pre-bash', bash(root, 'git status', input)).output, undefined);
    assert.equal(run('subagent-start', { cwd: root, ...input }).output, undefined);
    assert.equal(JSON.parse(readFileSync(join(root, runState(input)), 'utf8')).calls, FIRST_NOTICE - 1);
  }
  assert.equal(existsSync(join(root, '.ddd-ts-kit', 'agent.json')), false);
});

test('the worktree of a builder records its agent, and the calls of each row it commits', () => {
  const root = committed();
  const agent = builder('recorder');
  run('pre-bash', bash(root, 'git status', agent));
  assert.equal(existsSync(join(root, '.ddd-ts-kit', 'agent.json')), false, 'never outside a worker');
  worker(root);
  run('pre-bash', bash(root, 'git status', agent));
  run('pre-write', { cwd: root, ...write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent) });
  const commit = 'git add src && git commit -m "feat(ordering): place an order" -m "Slice: M1.14"';
  run('pre-bash', bash(root, commit, agent));
  const recorded = agentFile(root);
  assert.equal(recorded.agentId, 'recorder');
  assert.equal(recorded.sessionId, 'conductor');
  assert.equal(recorded.run, 1);
  assert.equal(recorded.toolCalls, 4);
  assert.deepEqual(recorded.rowCosts, { 'M1.14': 3 });
  assert.match(recorded.runStartHead, /^[0-9a-f]{40}$/);
  assert.ok(Date.parse(recorded.lastSeen) > 0);
});

test('at its own stop, a builder with a verified slice uncommitted is kept going once', () => {
  const root = committed();
  worker(root);
  const agent = builder('stopper');
  run('pre-bash', bash(root, 'git status', agent));
  put(root, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  const stopping = { cwd: root, ...agent, stop_hook_active: false };
  assert.equal(run('subagent-stop', stopping).output, undefined, "a stale report is the hook's to write, not a block");
  assert.equal(agentFile(root).lastStop.reportCurrent, false);

  const verified = builder('verified');
  run('pre-bash', bash(root, 'git status', verified));
  const later = verifiedAtHead(root);
  put(root, '.ddd-ts-kit/report.md', 'Slices done: none.\n');
  const uncommitted = run('subagent-stop', { cwd: root, ...verified, stop_hook_active: false });
  assert.match(uncommitted.output.reason, /verify-slice passed but the slice is not committed/);
  assert.equal(
    run('subagent-stop', { cwd: root, ...verified, stop_hook_active: false }).output,
    undefined,
    'once a run',
  );
  assert.equal(run('subagent-stop', { cwd: root, ...verified, stop_hook_active: true }).output, undefined);

  const done = builder('done');
  run('pre-bash', bash(root, 'git status', done));
  rmSync(join(root, '.ddd-ts-kit', 'verification.json'));
  utimesSync(join(root, '.ddd-ts-kit', 'report.md'), later, later);
  assert.equal(run('subagent-stop', { cwd: root, ...done, stop_hook_active: false }).output, undefined);
  assert.equal(agentFile(root).lastStop.reportCurrent, true);
  assert.equal(run('subagent-stop', { cwd: root, ...builder('unknown'), stop_hook_active: false }).output, undefined);
});

// A verify-slice that passed at the commit of the worktree, a few seconds from now: after every change made so far.
function verifiedAtHead(root) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const later = new Date(Date.now() + 5000);
  put(root, '.ddd-ts-kit/verification.json', JSON.stringify({ at: later.toISOString(), head, ok: true }));
  return later;
}

test('a builder that renamed a file of its slice and verified it is kept going to commit it', () => {
  const root = committed();
  put(root, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'feat(ordering): an order');
  worker(root);
  const agent = builder('renamer');
  run('pre-bash', bash(root, 'git status', agent));
  git(root, 'mv', 'src/contexts/ordering/domain/order.ts', 'src/contexts/ordering/domain/purchase-order.ts');
  verifiedAtHead(root);
  const stopping = run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false });
  assert.match(stopping.output.reason, /verify-slice passed but the slice is not committed/);
});

test('at its stop, the slice of a builder is read in src/contexts when the config leaves contextsDir out', () => {
  const root = committed();
  const { contextsDir, ...config } = JSON.parse(readFileSync(join(root, 'ddd-ts-kit.config.json'), 'utf8'));
  assert.equal(contextsDir, 'src/contexts');
  writeFileSync(join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));
  worker(root);
  const agent = builder('defaults');
  run('pre-bash', bash(root, 'git status', agent));
  put(root, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  verifiedAtHead(root);
  const stopping = run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false });
  assert.match(stopping.output.reason, /verify-slice passed but the slice is not committed/);
});

test('the first start of a builder opens its first run, counted from zero', () => {
  const root = project();
  const agent = builder('fresh');
  assert.equal(run('subagent-start', { cwd: root, ...agent }).output, undefined);
  const started = JSON.parse(readFileSync(join(root, runState(agent)), 'utf8'));
  assert.equal(started.run, 1);
  assert.equal(started.calls, 0);
  assert.deepEqual(started.notices, []);
});

const REPORT = join('.ddd-ts-kit', 'report.md');

test('at its stop, the final message of a builder becomes the report of its worktree', () => {
  const root = committed();
  worker(root);
  const agent = builder('reporter');
  run('pre-bash', bash(root, 'git status', agent));
  const agent_transcript_path = transcript(root, [
    said('first thoughts'),
    { type: 'user', message: { role: 'user', content: 'continue' } },
    said('Slices done: #M1.14 (abc1234).'),
  ]);
  run('subagent-stop', { cwd: root, ...agent, agent_transcript_path, stop_hook_active: false });
  assert.equal(readFileSync(join(root, REPORT), 'utf8'), 'Slices done: #M1.14 (abc1234).\n');
  assert.equal(agentFile(root).lastStop.reportCurrent, true);

  const given = builder('given');
  run('pre-bash', bash(root, 'git status', given));
  run('subagent-stop', { cwd: root, ...given, last_assistant_message: 'From the input.', stop_hook_active: false });
  assert.equal(readFileSync(join(root, REPORT), 'utf8'), 'From the input.\n');
});

test('a builder outside a git repository has its report written at its stop all the same', () => {
  const root = project();
  worker(root);
  const agent = builder('untracked');
  run('pre-bash', bash(root, 'git status', agent));
  run('subagent-stop', { cwd: root, ...agent, last_assistant_message: 'Slices done: none.', stop_hook_active: false });
  assert.equal(readFileSync(join(root, REPORT), 'utf8'), 'Slices done: none.\n');
});

test('a report that cannot be written leaves the builder free to stop', () => {
  const root = committed();
  worker(root);
  const agent = builder('unwritten');
  run('pre-bash', bash(root, 'git status', agent));
  mkdirSync(join(root, REPORT));
  const stopping = { cwd: root, ...agent, last_assistant_message: 'Slices done: none.', stop_hook_active: false };
  const result = run('subagent-stop', stopping);
  assert.equal(result.status, 0);
  assert.equal(result.output, undefined);
});

test('another agent writes no report, and a broken transcript fails open', () => {
  const root = committed();
  worker(root);
  const other = { session_id: 'conductor', agent_id: 'reviewer', agent_type: 'ddd-ts-kit:architecture-reviewer' };
  const path = transcript(root, [said('A review.')]);
  assert.equal(run('subagent-stop', { cwd: root, ...other, agent_transcript_path: path }).status, 0);
  assert.equal(existsSync(join(root, REPORT)), false);

  const agent = builder('broken');
  run('pre-bash', bash(root, 'git status', agent));
  for (const lines of [['not json', '{"type":"assistant"}', '[1]'], []]) {
    const result = run('subagent-stop', {
      cwd: root,
      ...agent,
      agent_transcript_path: transcript(root, lines),
      stop_hook_active: false,
    });
    assert.equal(result.status, 0);
    assert.equal(existsSync(join(root, REPORT)), false);
  }
  const missing = run('subagent-stop', { cwd: root, ...agent, agent_transcript_path: join(root, 'nope.jsonl') });
  assert.equal(missing.status, 0);
  assert.equal(existsSync(join(root, REPORT)), false);
  const conductor = transcript(root, [
    { type: 'assistant', message: { content: [{ type: 'text', text: 'The conductor speaking.' }] } },
  ]);
  const onlyTheConductor = run('subagent-stop', { cwd: root, ...agent, transcript_path: conductor });
  assert.equal(onlyTheConductor.status, 0);
  assert.equal(existsSync(join(root, REPORT)), false);
});

test('a report or a run state a repository links elsewhere is never written through the link', () => {
  const root = committed();
  worker(root);
  const outside = directory('outside');
  const [report, state] = [join(outside, 'bashrc'), join(outside, 'state')];
  writeFileSync(report, 'untouched\n');
  writeFileSync(state, 'untouched\n');
  symlinkSync(report, join(root, REPORT));
  const agent = builder('linked');
  mkdirSync(join(root, '.ddd-ts-kit', 'guard'));
  symlinkSync(state, join(root, runState(agent)));
  run('pre-bash', bash(root, 'git status', agent));
  const stopped = run('subagent-stop', {
    cwd: root,
    ...agent,
    last_assistant_message: 'Done.',
    stop_hook_active: false,
  });
  assert.equal(stopped.status, 0);
  assert.equal(readFileSync(report, 'utf8'), 'untouched\n');
  assert.equal(readFileSync(state, 'utf8'), 'untouched\n');
});

test('a .ddd-ts-kit folder that is a link receives no write of the guard', () => {
  const root = committed();
  const elsewhere = directory('elsewhere');
  put(elsewhere, 'worker.json', JSON.stringify({ context: 'ordering' }));
  symlinkSync(elsewhere, join(root, '.ddd-ts-kit'));
  const agent = builder('linked-folder');
  assert.equal(decision(run('pre-bash', bash(root, 'rm src/main.ts', agent))), 'deny');
  run('subagent-stop', { cwd: root, ...agent, last_assistant_message: 'Done.', stop_hook_active: false });
  assert.deepEqual(readdirSync(elsewhere), ['worker.json']);
});

function transcript(root, lines) {
  const file = join(root, 'transcript.jsonl');
  writeFileSync(file, lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n'));
  return file;
}

function said(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

test('the hooks add no entry on every tool call: two rare events, filtered by the builder', () => {
  const { hooks } = JSON.parse(readFileSync(join(here, 'hooks.json'), 'utf8'));
  const matchers = Object.entries(hooks).flatMap(([event, entries]) =>
    entries.map((entry) => `${event} ${entry.matcher ?? ''}`),
  );
  assert.deepEqual(matchers, [
    'SessionStart startup|resume|clear|compact',
    'PreToolUse Write|Edit|MultiEdit',
    'PreToolUse Bash',
    'PostToolUse Write|Edit|MultiEdit',
    'Stop ',
    'SubagentStart ^ddd-ts-kit:context-builder$',
    'SubagentStop ^ddd-ts-kit:context-builder$',
  ]);
});

test('an agent of the project named context-builder without the prefix of the plugin is held to its scope, not counted', () => {
  const root = committed();
  worker(root);
  const agent = builder('unprefixed', { agent_type: 'context-builder' });
  assert.equal(decision(run('pre-bash', bash(root, 'rm src/main.ts', agent))), 'deny');
  run('subagent-start', { cwd: root, ...agent });
  assert.equal(existsSync(join(root, runState(agent))), false);
  assert.equal(existsSync(join(root, '.ddd-ts-kit', 'agent.json')), false);
});

test('a new run of a builder drops the note its last run left before inline code, and keeps what that code changed', () => {
  const root = committed();
  worker(root);
  const agent = builder('resumed');
  run('pre-bash', bash(root, 'git status', agent));
  const [note, outside] = ['before-run', 'outside'].map((kind) =>
    join(root, `.ddd-ts-kit/guard/${kind}-${stateKey(agent)}.json`),
  );
  put(root, relative(root, note), '{}');
  put(root, relative(root, outside), '{}');
  run('subagent-start', { cwd: root, ...agent });
  assert.equal(existsSync(note), false);
  assert.equal(existsSync(outside), true);
});

test('a new run of a builder removes no note through a folder of the guard its worktree links elsewhere', () => {
  const root = committed();
  const worktree = project();
  const agent = builder('linked-worktree');
  put(root, runState(agent), JSON.stringify({ run: 1, calls: 3, notices: [], worker: worktree }));
  const shared = directory('shared');
  const note = `before-run-${stateKey(agent)}.json`;
  put(shared, note, '{}');
  mkdirSync(join(worktree, '.ddd-ts-kit'), { recursive: true });
  symlinkSync(shared, join(worktree, '.ddd-ts-kit/guard'));
  run('subagent-start', { cwd: root, ...agent });
  assert.deepEqual(readdirSync(shared), [note]);
});

test('malformed input to the runs of a builder never blocks', () => {
  for (const mode of ['subagent-start', 'subagent-stop']) {
    const result = spawnSync('node', [guard, mode], { input: 'not json', encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
  const root = committed();
  worker(root);
  const broken = builder('broken');
  put(root, runState(broken), '{not json');
  assert.equal(run('pre-bash', bash(root, 'git status', broken)).status, 0);
});

test('a count that fails never drops a refusal: a builder whose run state cannot be written is still refused', () => {
  const root = committed();
  worker(root);
  const agent = builder('unwritable');
  mkdirSync(join(root, runState(agent)), { recursive: true });
  const refused = run('pre-bash', bash(root, 'rm src/main.ts', agent));
  assert.equal(decision(refused), 'deny');
  assert.equal(noticeOf(refused), undefined);
  // A state that is no run makes the count itself throw.
  const odd = builder('odd');
  put(root, runState(odd), '"not a run"');
  assert.equal(decision(run('pre-bash', bash(root, 'rm src/main.ts', odd))), 'deny');
});

test('the scope of a worker is pinned at its first call: a scope file its code removes stops it (removeScope)', () => {
  const root = committed();
  worker(root, 'ordering');
  const agent = builder('pinned', { cwd: root });
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  rmSync(join(root, '.ddd-ts-kit/worker.json'));
  const refused = run('pre-bash', bash(root, 'echo x > src/main.ts', agent));
  assert.equal(decision(refused), 'deny');
  assert.match(
    reason(refused),
    /^ddd-ts-kit: The scope file changed: \.ddd-ts-kit\/worker\.json of your worktree named the context "ordering" at your first call and now is gone/,
  );
  const inside = run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent));
  assert.match(reason(inside), /The scope file changed: .* report to the conductor, who restores it/);
  // Another context in its place is no scope either; the conductor's own file puts the worker back.
  worker(root, 'billing');
  assert.match(reason(run('pre-bash', bash(root, 'git status', agent))), /now names the context "billing"/);
  worker(root, 'ordering');
  assert.equal(run('pre-bash', bash(root, 'git status', agent)).output, undefined);
  assert.equal(decision(run('pre-bash', bash(root, 'echo x > src/main.ts', agent))), 'deny');
});

test('a worker pinned to its worktree does not work in the worktree of another worker', () => {
  const { conductor, worktree } = conductorWithWorker();
  const other = join(conductor, '.worktrees', 'shipping');
  git(conductor, 'worktree', 'add', '--quiet', '-b', 'work/shipping', other);
  put(other, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'shipping' }));
  const agent = builder('billing-worker', { cwd: conductor });
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent)).output, undefined);
  const strayed = run('pre-bash', bash(conductor, `cd ${other} && git status`, agent));
  assert.equal(decision(strayed), 'deny');
  assert.match(reason(strayed), new RegExp(`context "billing" in the worktree ${worktree}, pinned at your first call`));
});

test('code of a worker that writes into the checkout of the session is said to it once, for the conductor (otherCheckout)', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = builder('other-checkout', { cwd: conductor });
  // Its own guard state in the conductor's checkout, and a run that changed nothing there, say nothing.
  for (let call = 0; call < 2; call += 1) {
    assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  }
  put(conductor, 'src/platform/evil.ts', 'export const evil = 1;\n');
  const told = run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent));
  assert.equal(decision(told), 'deny');
  assert.match(
    reason(told),
    new RegExp(`checkout of the session, ${conductor}, changed while your last command ran: src/platform/evil\\.ts\\.`),
  );
  assert.match(reason(told), /put nothing back there yourself; stop and report them to the conductor/);
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent)).output, undefined);
  // From the conductor's checkout, outside every worktree, code is refused rather than run unnoted.
  for (const command of [`node ${worktree}/src/contexts/billing/tool.mjs`, 'python3 x.py', 'bash x.sh', 'npm test']) {
    const stray = run('pre-bash', bash(conductor, command, agent));
    assert.match(reason(stray), /Run it as `cd <worktree> && \.\.\.`/, command);
  }
  assert.equal(run('pre-bash', bash(conductor, `cat ${worktree}/README.md`, agent)).output, undefined);
});

test('a commit or a merge of the conductor in its own checkout while a worker command runs is not charged to the worker', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = builder('conductor-commits', { cwd: conductor });
  // A file the conductor left changed before the command, and that stays so, is not the worker's.
  put(conductor, 'docs/notes.md', 'Notes of the conductor.\n');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  put(conductor, 'docs/architecture/plan.md', '# Plan\n\nNext: billing.\n');
  git(conductor, 'add', 'docs/architecture/plan.md');
  git(conductor, 'commit', '--quiet', '--no-verify', '--message', 'docs: plan');
  git(conductor, 'checkout', '--quiet', '-b', 'side');
  put(conductor, 'README.md', 'From a side branch.\n');
  git(conductor, 'commit', '--quiet', '--no-verify', '--all', '--message', 'docs: readme');
  git(conductor, 'checkout', '--quiet', 'main');
  git(conductor, 'merge', '--quiet', '--no-ff', '--no-edit', 'side');
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && npm test`, agent)).output, undefined);
  // A file of its working tree changed and not committed is still said.
  put(conductor, 'src/platform/evil.ts', 'export const evil = 1;\n');
  assert.match(
    reason(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent))),
    /src\/platform\/evil\.ts/,
  );
});

test('the worktree of a pinned worker reached through a link is the same worktree, not another worker', () => {
  const { conductor, worktree } = conductorWithWorker();
  const link = join(directory('link'), 'billing');
  symlinkSync(worktree, link);
  const agent = builder('linked', { cwd: conductor });
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, agent)).output, undefined);
  assert.equal(run('pre-bash', bash(conductor, `cd ${link} && git status`, agent)).output, undefined);
  assert.match(
    reason(run('pre-bash', bash(conductor, `cd ${link} && echo x > src/main.ts`, agent))),
    /context "billing"/,
  );
});

test('the scope pin of a builder is pruned at the session start of the conductor and released at its stop', () => {
  const { conductor, worktree } = conductorWithWorker();
  const pinOf = (agent) => join(conductor, '.ddd-ts-kit/guard', `scope-${stateKey(agent)}.json`);
  const stopped = builder('stopped', { cwd: conductor });
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, stopped)).output, undefined);
  assert.equal(existsSync(pinOf(stopped)), true);
  run('subagent-stop', { cwd: conductor, ...stopped });
  assert.equal(existsSync(pinOf(stopped)), false);
  // A pin whose scope file changed stays at the stop, for the conductor to see; a week later it goes.
  const changed = builder('changed', { cwd: conductor });
  assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && git status`, changed)).output, undefined);
  rmSync(join(worktree, '.ddd-ts-kit/worker.json'));
  run('subagent-stop', { cwd: conductor, ...changed });
  assert.equal(existsSync(pinOf(changed)), true);
  const old = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  utimesSync(pinOf(changed), old, old);
  run('session', { cwd: conductor, source: 'startup' });
  assert.equal(existsSync(pinOf(changed)), false);
});

test('a builder runs no test runner or script from the conductor checkout: a path to a program is code too', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = builder('runners', { cwd: conductor });
  for (const command of [
    './node_modules/.bin/vitest run',
    './scripts/seed.sh',
    '../seed.sh',
    `${worktree}/scripts/seed.sh`,
    'node_modules/.bin/tsx x.ts',
    'vitest run',
    'jest',
    'mocha',
  ]) {
    assert.match(
      reason(run('pre-bash', bash(conductor, command, agent))),
      /Run it as `cd <worktree> && \.\.\.`/,
      command,
    );
  }
  assert.equal(run('pre-bash', bash(conductor, `/bin/cat ${worktree}/README.md`, agent)).output, undefined);
});

test("a sub-agent never deletes, moves or resets the branch of another worker's worktree", () => {
  const { conductor, worktree } = conductorWithWorker();
  const other = join(conductor, '.worktrees', 'shipping');
  git(conductor, 'worktree', 'add', '--quiet', '-b', 'work/shipping', other);
  git(conductor, 'branch', 'scratch');
  const agent = builder('branches', { cwd: conductor });
  for (const command of [
    'git branch -D work/shipping',
    'git branch --delete --force main',
    'git branch -m work/shipping shipping-old',
    'git branch -M scratch work/shipping',
    'git branch -f work/shipping HEAD',
    'cd . ; git branch -D work/shipping',
  ]) {
    const refused = run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent));
    assert.match(reason(refused), /never deletes, moves or resets the branch of another worktree/, command);
  }
  for (const command of [
    'git branch -D scratch',
    'git branch -m work/billing work/billing-2',
    'git branch -f scratch HEAD',
  ]) {
    assert.equal(run('pre-bash', bash(conductor, `cd ${worktree} && ${command}`, agent)).output, undefined, command);
  }
  // A host that sends no working directory: the guard reads the one it starts in.
  const { cwd, ...sent } = bash(worktree, 'git branch -D work/shipping', agent);
  assert.match(reason(runFrom(cwd, 'pre-bash', sent)), /branch of another worktree/);
  // Outside a git repository, there is no branch to hold.
  const loose = project();
  assert.equal(run('pre-bash', bash(loose, 'git branch -D main', builder('loose', { cwd: loose }))).output, undefined);
});

test("the guard's own git runs no program a repository plants in its config or its hooks", () => {
  const root = committed();
  // Without the CLI of the project, which runs git of its own: what runs here is the guard's git alone.
  rmSync(join(root, 'node_modules'), { recursive: true, force: true });
  worker(root);
  const marker = join(guardTemp, 'planted-program-ran');
  const program = join(root, '.git', 'planted.sh');
  writeFileSync(program, `#!/bin/sh\ntouch ${marker}\nexit 1\n`, { mode: 0o755 });
  git(root, 'config', 'core.fsmonitor', program);
  writeFileSync(join(root, '.git/hooks/post-index-change'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
  const agent = builder('planted');
  run('pre-bash', bash(root, 'git status', agent));
  put(root, 'src/contexts/ordering/domain/order.ts', 'export const order = 1;\n');
  utimesSync(join(root, 'package.json'), new Date(), new Date());
  run('subagent-stop', { cwd: root, ...agent, stop_hook_active: false });
  run('stop', { cwd: root });
  assert.equal(existsSync(marker), false);
});
