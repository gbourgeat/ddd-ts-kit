// The runs of a context-builder agent, loaded by the guard only when such an agent calls a tool or
// starts or stops: every other call of the guard skips it. Counts the agent's tool calls inside the
// guard calls that already run (pre-bash, pre-write), warns it twice before its turn limit, and
// records in its worktree what `worker-scope --resume` reads back. Fails open, like the guard.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AGENT_FILE = '.ddd-ts-kit/agent.json';
const REPORT_FILE = '.ddd-ts-kit/report.md';
const VERIFICATION_FILE = '.ddd-ts-kit/verification.json';
const DEFAULT_LIMIT = 150;

// Calibration. The guard sees the shell and the writes (Bash, Write, Edit, MultiEdit), never the
// reads (Read, Grep, Glob): its count is below the turns taken. Two real context-builder runs,
// measured with a hook on every tool, made all their calls but one through the shell (30 of 30,
// then 47 of 47, so about one counted call per turn; parallel calls in one turn count more than
// one, the safe side). An agent that reads through Read and Grep is counted less: the thresholds
// assume a quarter of uncounted calls for the first notice and about a sixth for the second, so
// that the first arrives with at least 30 turns left even then. On a typical run they arrive
// earlier (at 90 and 117 of 150): stopping early costs a SendMessage, stopping late loses a report.
const FIRST = { left: 30, counted: 0.75 };
const SECOND = { left: 12, counted: 0.85 };

const NOTICES = {
  first:
    'ddd-ts-kit: your turn limit is near (about 30 turns left, or more). Finish the slice under way; start no other one (list it as not done in your report).',
  second:
    'ddd-ts-kit: your turn limit is close (about 12 turns left, or more). Stop changing code. If `verify-slice` passed, commit with the command it printed; otherwise leave the files as they are. Then end with your report as your final message.',
};

/**
 * Counts one tool call of a builder and answers the notice it is due, if any. `places.state` is
 * the file of its run in the guard's folder; `places.worker` the project of its worktree when the
 * call shows it (its scope file is there), else the one recorded earlier.
 */
export function countCall(input, places, command) {
  const run = readJson(places.state) ?? newRun();
  const worker = places.worker ?? run.worker;
  const thresholds = thresholdsOf(limitOf());
  run.calls += 1;
  const due = run.calls >= thresholds.second ? 'second' : run.calls >= thresholds.first ? 'first' : undefined;
  const notice = due && !run.notices.includes(due) ? due : undefined;
  if (notice) {
    run.notices = notice === 'second' ? ['first', 'second'] : ['first'];
  }
  writeJson(places.state, { ...run, ...(worker ? { worker } : {}) });
  if (worker) {
    recordAgent(worker, { input, run, command });
  }
  return notice ? NOTICES[notice] : undefined;
}

/** A new run of the agent, at its launch or its resume: the count starts again, as the turn budget does. */
export function startRun(input, places) {
  const previous = readJson(places.state);
  const run = { ...newRun(), run: (previous?.run ?? 0) + 1, ...(previous?.worker ? { worker: previous.worker } : {}) };
  writeJson(places.state, run);
  if (run.worker) {
    recordAgent(run.worker, { input, run, command: undefined, calls: 0 });
  }
}

/**
 * The agent ends on its own (a stop at the turn limit runs no hook). Records the stop in its
 * worktree and, once a run, keeps it going with one instruction when it would leave a slice that
 * passed verify-slice uncommitted, or no current report.
 */
export function stopRun(input, places) {
  const run = readJson(places.state);
  if (!run?.worker || !existsSync(run.worker)) {
    return undefined;
  }
  writeReport(run.worker, input);
  const slice = sliceState(run.worker);
  const agent = readJson(join(run.worker, AGENT_FILE));
  if (agent) {
    writeJson(join(run.worker, AGENT_FILE), {
      ...agent,
      lastStop: { at: new Date().toISOString(), reportCurrent: slice.reportCurrent },
    });
  }
  if (input.stop_hook_active || run.stopBlocked === run.run) {
    return undefined;
  }
  const reason = stopReason(slice);
  if (reason) {
    writeJson(places.state, { ...run, stopBlocked: run.run });
  }
  return reason;
}

function stopReason(slice) {
  if (slice.verifiedUncommitted) {
    return 'ddd-ts-kit: verify-slice passed but the slice is not committed. Commit it with the command verify-slice printed, then end with your report as your final message.';
  }
  return undefined;
}

/**
 * Claude Code refuses a sub-agent the write of a report file: the builder ends with its report as
 * its final message, and the file `worker-scope --resume` reads is written here, from that message
 * (the hook input, else the last assistant message of the transcript it names). Fails open.
 */
export function writeReport(worker, input) {
  try {
    const report = finalMessage(input);
    if (report) {
      mkdirSync(join(worker, '.ddd-ts-kit'), { recursive: true });
      writeFileSync(join(worker, REPORT_FILE), `${report}\n`);
    }
  } catch {
    // fail open
  }
}

function finalMessage(input) {
  const given = typeof input.last_assistant_message === 'string' ? input.last_assistant_message.trim() : '';
  if (given) {
    return given;
  }
  const path = [input.agent_transcript_path, input.transcript_path].find((value) => typeof value === 'string');
  const lines = (path ? (readText(path) ?? '') : '').split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const text = assistantText(lines[index]);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function assistantText(line) {
  try {
    const entry = JSON.parse(line);
    const message = entry?.message ?? entry;
    if (entry?.type !== 'assistant' && message?.role !== 'assistant') {
      return undefined;
    }
    const content = message.content;
    const text = Array.isArray(content)
      ? content
          .filter((block) => block?.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text)
          .join('\n')
      : content;
    return typeof text === 'string' && text.trim() ? text.trim() : undefined;
  } catch {
    return undefined;
  }
}

function newRun() {
  return { run: 1, calls: 0, notices: [], startedAt: new Date().toISOString() };
}

// The thresholds in counted calls for a limit in turns.
function thresholdsOf(limit) {
  return {
    first: Math.max(1, Math.floor((limit - FIRST.left) * FIRST.counted)),
    second: Math.max(2, Math.floor((limit - SECOND.left) * SECOND.counted)),
  };
}

// The turn limit of the agent, from its own definition next to the hooks: `maxTurns` of its front matter.
function limitOf() {
  const definition = join(dirname(fileURLToPath(import.meta.url)), '..', 'agents', 'context-builder.md');
  const front = /^---\n([\s\S]*?)\n---/.exec(readText(definition) ?? '')?.[1] ?? '';
  const limit = Number(/^maxTurns:\s*(\d+)\s*$/m.exec(front)?.[1]);
  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
}

// What the conductor reads of the agent: its id, its run, when it was last seen, its counted
// calls, and the calls each committed row took (a `git commit` naming its `Slice:`).
function recordAgent(worker, { input, run, command, calls }) {
  const file = join(worker, AGENT_FILE);
  const known = readJson(file) ?? {};
  const now = new Date().toISOString();
  const sameRun = known.agentId === input.agent_id && known.run === run.run;
  const sinceSlice = (known.callsSinceSlice ?? 0) + (calls === 0 ? 0 : 1);
  const slice = command ? /\bgit\b[^\n;&|]*\bcommit\b[\s\S]*?\bSlice:\s*#?([\w.-]+)/.exec(command)?.[1] : undefined;
  const rowCosts = { ...(known.rowCosts ?? {}) };
  if (slice) {
    rowCosts[slice] = (rowCosts[slice] ?? 0) + sinceSlice;
  }
  writeJson(file, {
    agentId: input.agent_id ?? '',
    sessionId: input.session_id ?? '',
    run: run.run,
    runStartedAt: sameRun ? known.runStartedAt : run.startedAt,
    runStartHead: sameRun ? known.runStartHead : gitLine(worker, ['rev-parse', 'HEAD']),
    lastSeen: now,
    toolCalls: calls ?? run.calls,
    rowCosts,
    callsSinceSlice: slice ? 0 : sinceSlice,
    lastStop: sameRun ? (known.lastStop ?? null) : null,
  });
}

// Whether the report is current (written after the last commit and the last change of the slice),
// and whether a verification that passed at this commit is left uncommitted with nothing changed since.
function sliceState(worker) {
  const scope = readJson(join(worker, '.ddd-ts-kit', 'worker.json'));
  const contextsDir = readJson(join(worker, 'ddd-ts-kit.config.json'))?.contextsDir ?? 'src/contexts';
  const inSlice = changedPaths(worker).filter(
    (path) => path.startsWith(`${contextsDir}/${scope?.context}/`) || /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/.test(path),
  );
  const changed = inSlice.map((path) => modifiedAt(join(worker, path)));
  const committed = Number(gitLine(worker, ['log', '-1', '--format=%ct']) ?? 0) * 1000;
  const report = modifiedAt(join(worker, REPORT_FILE));
  const verification = readJson(join(worker, VERIFICATION_FILE));
  const verifiedAt = Date.parse(verification?.at ?? '');
  return {
    reportCurrent: report > 0 && report >= committed && changed.every((time) => report >= time),
    verifiedUncommitted:
      verification?.ok === true &&
      inSlice.length > 0 &&
      verification.head === gitLine(worker, ['rev-parse', 'HEAD']) &&
      changed.every((time) => time <= verifiedAt),
  };
}

function changedPaths(worker) {
  const status = git(worker, ['status', '--porcelain=v1', '-z', '--untracked-files=all']) ?? '';
  const entries = status.split('\0');
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index].length > 3) {
      paths.push(entries[index].slice(3));
      index += /^[RC]/.test(entries[index]) ? 1 : 0;
    }
  }
  return paths;
}

function modifiedAt(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function git(directory, args) {
  const run = spawnSync('git', args, { cwd: directory, encoding: 'utf8', timeout: 3000 });
  return run.status === 0 ? run.stdout : undefined;
}

function gitLine(directory, args) {
  return git(directory, args)?.trim() || null;
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
}
