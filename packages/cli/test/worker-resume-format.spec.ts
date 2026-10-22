import { describe, expect, it } from 'vitest';
import { formatResume } from '../src/worker/format-resume';
import type { WorkerResume } from '../src/worker/resume-worker';
import { resumeMessage } from '../src/worker/resume-message';
import type { ProgressVerification, WorkerProgress } from '../src/worker/worker-progress';

const PLACE = { context: 'billing', project: '/work/billing', base: 'origin/main' };

function progressOf(overrides: Partial<WorkerProgress> = {}): WorkerProgress {
  return {
    rows: [
      { id: '1', slice: 'Issue an invoice', state: 'committed', commit: 'abc1234', byOrder: true },
      { id: '2', slice: 'Cancel an invoice', state: 'in progress' },
      { id: '3', slice: '', state: 'to do' },
    ],
    inSlice: ['src/contexts/billing/domain/invoice.ts'],
    leftOut: [],
    markers: { domain: 0, test: 2 },
    verification: null,
    report: null,
    agent: null,
    phase: 'mid-row',
    next: { action: 'new-agent' },
    ...overrides,
  };
}

function verification(overrides: Partial<ProgressVerification> = {}): ProgressVerification {
  return {
    at: '2026-10-18T09:15:42.123Z',
    head: 'abc1234',
    row: '2',
    ok: false,
    failed: [],
    toStage: [],
    changedAfter: 1,
    committedAfter: false,
    ...overrides,
  };
}

function resumeOf(progress: WorkerProgress, overrides: Partial<WorkerResume> = {}): WorkerResume {
  return {
    context: 'billing',
    worktree: '/work',
    root: '/work/billing',
    branch: undefined,
    base: undefined,
    progress,
    next: progress.next,
    sendMessage: null,
    briefing: 'Build row #2.',
    notes: [],
    ...overrides,
  };
}

describe('the resume of a worker for the conductor', () => {
  it('says a detached worker of unknown base has no report, no agent, and a slice not verified yet', () => {
    const text = formatResume(resumeOf(progressOf()));

    expect(text.split('\n').slice(0, 5)).toEqual([
      'worker (detached)  /work  (base unknown)',
      'rows: #1 committed abc1234 (by order), #2 in progress, #3 to do',
      '#2: 1 file uncommitted (src/contexts/billing/domain/invoice.ts), 0 TODO(domain), 2 it.todo; verify-slice not run',
      'report: none written',
      'agent: none recorded by the guard',
    ]);

    expect(text).toContain('next: launch a new context-builder with this briefing:\n---\nBuild row #2.\n---');
  });

  it('gives the last verification to the minute, the steps that failed and the files changed since', () => {
    const failed = progressOf({
      inSlice: [],
      verification: verification({ failed: ['check', 'tests'], changedAfter: 3 }),
    });

    const passed = progressOf({ verification: verification({ ok: true, changedAfter: 0 }) });

    expect(formatResume(resumeOf(failed))).toContain(
      '#2: 0 files uncommitted (), 0 TODO(domain), 2 it.todo; last verify-slice 2026-10-18T09:15Z failed: check, tests (3 files changed since)',
    );

    expect(formatResume(resumeOf(passed))).toContain('last verify-slice 2026-10-18T09:15Z passed\n');
  });

  it('tells a current report from an older one, and an agent that ended on its own from one that stopped', () => {
    const agent = {
      agentId: 'agent-7',
      run: 2,
      runStartedAt: '2026-10-18T08:00:00Z',
      runStartHead: null,
      lastSeen: '2026-10-18T09:30:12Z',
      toolCalls: 41,
      rowCosts: {},
      lastStop: null,
    };

    const stopped = progressOf({ agent, report: { modified: '2026-10-18T09:00:05Z', current: false } });

    const ended = progressOf({
      agent: { ...agent, lastStop: { at: '2026-10-18T09:31:00Z', reportCurrent: true } },
      report: { modified: '2026-10-18T09:31:00Z', current: true },
    });

    expect(formatResume(resumeOf(stopped))).toContain(
      'report: written 2026-10-18T09:00Z (older than its last change)\nagent: agent-7, run 2, 41 tool calls counted, last tool call 2026-10-18T09:30Z, stopped without ending (a limit or an error) without a current report',
    );

    expect(formatResume(resumeOf(ended))).toContain('report: written 2026-10-18T09:31Z (current)');
    expect(formatResume(resumeOf(ended))).toContain('ended on its own with a current report');
  });

  it('gives the message for the agent first and the briefing as the fallback, with the notes', () => {
    const resume = resumeOf(progressOf({ next: { action: 'send-message', to: 'agent-7' } }), {
      branch: 'build/billing',
      base: 'origin/main',
      sendMessage: { to: 'agent-7', message: 'Continue row #2.' },
      notes: ['the agent was seen 1 minute ago'],
    });

    const text = formatResume(resume);

    expect(text.split('\n')[0]).toBe('worker build/billing  /work  (base origin/main)');
    expect(text).toContain('note: the agent was seen 1 minute ago');
    expect(text).toContain('next: SendMessage to agent-7:\n---\nContinue row #2.\n---\nIf SendMessage is refused');
  });

  it('says to merge once every row is committed, and when the scope file names no row', () => {
    const done = progressOf({ rows: [], next: { action: 'merge' } });

    expect(formatResume(resumeOf(done, { briefing: null }))).toContain(
      'rows: none in the scope file\nreport: none written',
    );

    expect(formatResume(resumeOf(done))).toContain(
      'next: every row is committed: merge the branch (parallel-work, step 6).',
    );
  });
});

describe('the message that resumes a stopped agent', () => {
  it('names the row to finish, the row not to start, what is committed and what it left', () => {
    expect(resumeMessage(progressOf({ markers: { domain: 1, test: 2 } }), PLACE).split('\n')).toEqual([
      'Continue row #2 (Cancel an invoice) in /work/billing; do not start #3.',
      'Committed: #1. Left modified by you: src/contexts/billing/domain/invoice.ts. 1 TODO(domain) and 2 it.todo remain; you have not run verify-slice yet.',
      'Next: finish #2, `npx ddd-ts-kit verify-slice billing --since origin/main` until it passes, commit with the command it prints, rewrite .ddd-ts-kit/report.md, end with the report.',
    ]);
  });

  it('says to commit when the last verification passed and nothing changed since', () => {
    const rows = [{ id: '3', slice: '', state: 'in progress' as const }];
    const progress = progressOf({ rows, inSlice: [], markers: { domain: 0, test: 0 } });
    const unchanged = { ...progress, verification: verification({ ok: true, changedAfter: 0 }) };
    const changed = { ...progress, verification: verification({ ok: true, changedAfter: 0, committedAfter: true }) };

    expect(resumeMessage(unchanged, PLACE).split('\n').slice(0, 2)).toEqual([
      'Continue row #3 in /work/billing.',
      'No marker remains; your last verify-slice passed and nothing changed since: commit with the command it printed.',
    ]);

    expect(resumeMessage(changed, PLACE)).toContain('your last verify-slice passed, files changed since.');
  });

  it('names the steps that failed, or a step when none is recorded, and the row under way when the scope names none', () => {
    const text = resumeMessage(progressOf({ rows: [], verification: verification({ failed: [] }) }), PLACE);

    expect(text).toContain('Continue the row under way in /work/billing.');
    expect(text).toContain('your last verify-slice failed at a step.');
    expect(text).toContain('Next: finish it, ');

    expect(resumeMessage(progressOf({ verification: verification({ failed: ['tests'] }) }), PLACE)).toContain(
      'failed at tests.',
    );
  });
});
