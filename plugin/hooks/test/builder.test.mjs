// The runs of a context-builder agent: its calls counted, its two notices, its run and its report recorded in
// its worktree.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, git, guard, here, project, put, run, worker, write } from './support.mjs';

// The runs of a context-builder: its tool calls counted inside pre-bash and pre-write, two notices
// before its turn limit, its run recorded in its worktree, its stop checked.
const LIMIT = Number(
  /^maxTurns:\s*(\d+)$/m.exec(readFileSync(join(here, '..', 'agents', 'context-builder.md'), 'utf8'))[1],
);
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
