import { describe, expect, it } from 'vitest';
import { formatResume } from '../src/worker/format-resume';
import { namedPaths } from '../src/worker/named-paths';
import { nextStepOf } from '../src/worker/next-step-of';
import { resumeMessage } from '../src/worker/resume-message';
import type { WorkerResume } from '../src/worker/resume-worker';
import { stateLineOf } from '../src/worker/state-line-of';
import type { AgentRecord, WorkerProgress } from '../src/worker/worker-progress';
import type { WorkerStatus } from '../src/worker/workers-status';

const AGENT: AgentRecord = {
  agentId: 'a7',
  run: 1,
  runStartedAt: '2020-01-01T00:00:00.000Z',
  runStartHead: null,
  lastSeen: '2020-01-01T00:10:00.000Z',
  toolCalls: 30,
  rowCosts: {},
  lastStop: null,
};

const PROGRESS: WorkerProgress = {
  rows: [
    { id: 'M1.01', slice: 'Issue invoice', state: 'committed', commit: 'a1b2c3d', byOrder: true },
    { id: 'M1.02', slice: '', state: 'in progress' },
  ],
  inSlice: ['src/contexts/billing/domain/pay.ts'],
  leftOut: [],
  markers: { domain: 0, test: 0 },
  verification: null,
  report: null,
  agent: null,
  phase: 'mid-row',
  next: { action: 'new-agent' },
};

const WORKER: WorkerStatus = {
  worktree: '/repo/shop-billing',
  context: 'billing',
  installed: true,
  files: [],
  report: null,
  progress: PROGRESS,
};

const verified = (ok: boolean, changedAfter: number, committedAfter = false): WorkerProgress['verification'] => ({
  at: '2020-01-01T00:05:00.000Z',
  head: 'abc',
  row: 'M1.02',
  ok,
  failed: [],
  toStage: [],
  changedAfter,
  committedAfter,
});

describe('the state of a worker in one line', () => {
  it('names the worktree when another worker builds the context, and the verification in every shape', () => {
    expect(stateLineOf({ ...WORKER, progress: { ...PROGRESS, verification: verified(false, 1, true) } }, true)).toBe(
      'stopped mid-row #M1.02 (1 file uncommitted, last verify-slice failed: unknown, 1 file changed since, committed since); resume: npx ddd-ts-kit worker-scope billing --resume --worktree /repo/shop-billing',
    );

    expect(stateLineOf({ ...WORKER, progress: { ...PROGRESS, verification: verified(true, 0) } }, false)).toContain(
      '(1 file uncommitted, last verify-slice passed);',
    );
  });

  it('says a worker not started, one between rows, and one with no progress to read', () => {
    expect(stateLineOf({ ...WORKER, progress: { ...PROGRESS, phase: 'not started', inSlice: [] } }, false)).toBe(
      'not started; resume: npx ddd-ts-kit worker-scope billing --resume',
    );

    expect(stateLineOf({ ...WORKER, progress: { ...PROGRESS, phase: 'between rows', inSlice: [] } }, false)).toBe(
      'between rows (#M1.01 committed, #M1.02 to do); resume: npx ddd-ts-kit worker-scope billing --resume',
    );

    const { progress: _left, ...without } = WORKER;

    expect(stateLineOf(without, false)).toBeUndefined();

    expect(stateLineOf({ ...WORKER, progress: { ...PROGRESS, next: { action: 'wait' }, agent: null } }, false)).toBe(
      'working mid-row #M1.02 (1 file uncommitted); an agent is working (last tool call unknown)',
    );
  });
});

describe('the next step of the conductor', () => {
  const facts = {
    phase: 'mid-row' as const,
    agent: AGENT,
    fresh: false,
    progressed: true,
    clean: false,
    stopped: true,
  };

  it('resumes an agent that progressed, and launches a new one otherwise', () => {
    expect(nextStepOf(facts)).toEqual({ action: 'send-message', to: 'a7' });
    expect(nextStepOf({ ...facts, agent: null })).toEqual({ action: 'new-agent' });
    expect(nextStepOf({ ...facts, progressed: false })).toEqual({ action: 'new-agent' });
    expect(nextStepOf({ ...facts, phase: 'rows committed' })).toEqual({ action: 'new-agent' });
    expect(nextStepOf({ ...facts, phase: 'rows committed', clean: true })).toEqual({ action: 'merge' });
  });

  it('waits for an agent seen a moment ago, unless it stopped since or the conductor knows it stopped', () => {
    const recent = { ...AGENT, lastSeen: new Date().toISOString() };

    expect(nextStepOf({ ...facts, agent: recent, stopped: false })).toEqual({ action: 'wait' });

    const ended = { ...recent, lastStop: { at: new Date(Date.now() + 1000).toISOString(), reportCurrent: true } };

    expect(nextStepOf({ ...facts, agent: ended, stopped: false })).toEqual({ action: 'send-message', to: 'a7' });
  });
});

describe('what resumes a worker', () => {
  it('counts the paths past twelve', () => {
    const paths = Array.from({ length: 14 }, (_, index) => `f${index}.ts`);

    expect(namedPaths(paths)).toMatch(/f11\.ts and 2 more$/);
    expect(namedPaths(['a.ts'])).toBe('a.ts');
  });

  it('writes the message from a row without a name, without markers, and from a verification that passed', () => {
    const place = { context: 'billing', project: '/repo/shop-billing', base: 'main' };
    const message = resumeMessage({ ...PROGRESS, verification: verified(true, 0) }, place);

    expect(message).toContain('Continue row #M1.02 in /repo/shop-billing.\n');
    expect(message).toContain('No marker remains; your last verify-slice passed and nothing changed since');

    expect(resumeMessage({ ...PROGRESS, verification: verified(true, 2) }, place)).toContain(
      'passed, files changed since.',
    );

    expect(resumeMessage({ ...PROGRESS, rows: [], inSlice: [] }, place)).toContain(
      'Continue the row under way in /repo/shop-billing.\nNo marker remains; you have not run verify-slice yet.\nNext: finish it,',
    );
  });

  it('prints a worker without rows, report or agent, and one to merge', () => {
    const resume: WorkerResume = {
      context: 'billing',
      worktree: '/repo/shop-billing',
      root: '/repo/shop-billing',
      branch: undefined,
      base: undefined,
      progress: { ...PROGRESS, rows: [] },
      next: { action: 'merge' },
      sendMessage: null,
      briefing: null,
      notes: [],
    };

    const text = formatResume(resume);

    expect(text).toContain('worker (detached)  /repo/shop-billing  (base unknown)\nrows: none in the scope file\n');
    expect(text).toContain('report: none written\nagent: none recorded by the guard\n');
    expect(text).toContain('next: every row is committed: merge the branch (parallel-work, step 6).');

    const stopped = formatResume({
      ...resume,
      progress: { ...PROGRESS, agent: { ...AGENT, lastStop: { at: AGENT.lastSeen, reportCurrent: false } } },
      next: { action: 'new-agent' },
      briefing: 'You build the bounded context billing of shop.',
    });

    expect(stopped).toContain('#M1.01 committed a1b2c3d (by order)');

    expect(stopped).toContain(
      '#M1.02: 1 file uncommitted (src/contexts/billing/domain/pay.ts), 0 TODO(domain), 0 it.todo; verify-slice not run',
    );

    expect(stopped).toContain('ended on its own without a current report');
    expect(stopped).toContain('next: launch a new context-builder with this briefing:\n---\nYou build');
  });
});
