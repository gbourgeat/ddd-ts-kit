import { describe, expect, it } from 'vitest';
import { readAgentRecord } from '../src/worker/read-agent-record';
import { readVerification } from '../src/worker/read-verification';
import { tempDir, write } from './helpers';

function projectWith(file: string, json: unknown): string {
  const root = tempDir('worker-records');

  write(root, file, JSON.stringify(json));

  return root;
}

describe('the last verify-slice of a worker', () => {
  it('is null when none ran, or when the file records no date', () => {
    expect(readVerification(tempDir('worker-records'), { head: 'abc', changed: [] })).toBeNull();

    expect(
      readVerification(projectWith('.ddd-ts-kit/verification.json', { ok: true }), { head: 'abc', changed: [] }),
    ).toBeNull();
  });

  it('reads what the file records, and counts the changes and the commit made after it', () => {
    const project = projectWith('.ddd-ts-kit/verification.json', {
      at: '2026-10-18T09:00:00.000Z',
      head: 'abc',
      row: '2',
      ok: false,
      failed: ['check', 3],
      toStage: ['src/a.ts'],
    });

    const after = Date.parse('2026-10-18T09:05:00.000Z');
    const before = Date.parse('2026-10-18T08:55:00.000Z');

    expect(readVerification(project, { head: 'def', changed: [before, after, after] })).toEqual({
      at: '2026-10-18T09:00:00.000Z',
      head: 'abc',
      row: '2',
      ok: false,
      failed: ['check'],
      toStage: ['src/a.ts'],
      changedAfter: 2,
      committedAfter: true,
    });

    expect(readVerification(project, { head: undefined, changed: [] })?.committedAfter).toBe(false);
    expect(readVerification(project, { head: 'abc', changed: [] })?.committedAfter).toBe(false);
  });

  it('reads no head, no row and no list from values of another type', () => {
    const project = projectWith('.ddd-ts-kit/verification.json', {
      at: '2026-10-18T09:00:00.000Z',
      head: 7,
      row: 2,
      ok: 'yes',
      failed: 'check',
    });

    expect(readVerification(project, { head: 'def', changed: [] })).toMatchObject({
      head: null,
      row: null,
      ok: false,
      failed: [],
      toStage: [],
      committedAfter: false,
    });
  });
});

describe('the agent the guard saw in a worktree', () => {
  it('is null when the guard recorded none, or a record without its id, run or last tool call', () => {
    expect(readAgentRecord(tempDir('worker-records'))).toBeNull();

    expect(
      readAgentRecord(projectWith('.ddd-ts-kit/agent.json', { agentId: 'a', run: '1', lastSeen: 'now' })),
    ).toBeNull();
  });

  it('reads the start of the run, the costs of its rows and its last stop', () => {
    const project = projectWith('.ddd-ts-kit/agent.json', {
      agentId: 'agent-7',
      run: 2,
      runStartedAt: '2026-10-18T08:00:00Z',
      runStartHead: 'abc',
      lastSeen: '2026-10-18T09:00:00Z',
      toolCalls: 41,
      rowCosts: { '1': 12, '2': 'many' },
      lastStop: { at: '2026-10-18T09:01:00Z', reportCurrent: true },
    });

    expect(readAgentRecord(project)).toEqual({
      agentId: 'agent-7',
      run: 2,
      runStartedAt: '2026-10-18T08:00:00Z',
      runStartHead: 'abc',
      lastSeen: '2026-10-18T09:00:00Z',
      toolCalls: 41,
      rowCosts: { '1': 12 },
      lastStop: { at: '2026-10-18T09:01:00Z', reportCurrent: true },
    });
  });

  it('reads what the guard found outside the scope at the stop as data: one line, cut', () => {
    const project = projectWith('.ddd-ts-kit/agent.json', {
      agentId: 'agent-7',
      run: 1,
      lastSeen: '2026-10-18T09:00:00Z',
      lastStop: { at: '2026-10-18T09:01:00Z', reportCurrent: true, outside: `one\n  two ${'x'.repeat(700)}` },
    });

    const outside = readAgentRecord(project)?.lastStop?.outside;

    expect(outside?.startsWith('one two xxx')).toBe(true);
    expect(outside).toHaveLength(600);
  });

  it('starts the run at the last tool call and counts no tool call when the record does not say', () => {
    const project = projectWith('.ddd-ts-kit/agent.json', {
      agentId: 'agent-7',
      run: 1,
      lastSeen: '2026-10-18T09:00:00Z',
      toolCalls: 'many',
      rowCosts: [],
      lastStop: { reportCurrent: true },
    });

    expect(readAgentRecord(project)).toEqual({
      agentId: 'agent-7',
      run: 1,
      runStartedAt: '2026-10-18T09:00:00Z',
      runStartHead: null,
      lastSeen: '2026-10-18T09:00:00Z',
      toolCalls: 0,
      rowCosts: {},
      lastStop: null,
    });
  });
});
