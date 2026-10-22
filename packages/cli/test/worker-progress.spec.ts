import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --public\` | | billing | todo |
| M1.02 | billing | slice | Pay invoice | \`generate command billing PayInvoice --public\` | | billing | todo |
`;

const ISSUE = 'src/contexts/billing/domain/issue.ts';
const PAY = 'src/contexts/billing/domain/pay.ts';
const PAY_SPEC = 'src/contexts/billing/test/unit/pay.spec.ts';
const OLD = '2020-01-01T00:00:00.000Z';

let root: string;
let worktree: string;

beforeEach(() => {
  root = committedProject('shop', '--context', 'billing:core');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');
  worktree = path.join(fs.realpathSync(root), '.worktrees', 'billing');
  expect(cli(root, 'worker-scope', 'billing', '--rows', 'M1.01,M1.02', '--no-install').code).toBe(0);
});

function commitRow(subject: string, ...trailer: string[]): void {
  write(worktree, ISSUE, `export const issued = '${subject}';\n`);
  git(worktree, 'add', ISSUE);
  git(worktree, 'commit', '--quiet', '--message', subject, ...trailer.flatMap((line) => ['--message', line]));
}

function startPay(): void {
  write(worktree, PAY, '// TODO(domain): a paid invoice is never paid again.\nexport const pay = 1;\n');
  write(worktree, PAY_SPEC, "import { it } from 'vitest';\n\nit.todo('refuses to pay twice');\n");
}

function agent(record: Record<string, unknown>): void {
  const base = { agentId: 'a7', run: 1, runStartedAt: OLD, runStartHead: null, lastSeen: OLD, toolCalls: 81 };

  write(worktree, '.ddd-ts-kit/agent.json', JSON.stringify({ ...base, rowCosts: {}, lastStop: null, ...record }));
}

function progress(): unknown {
  const [worker] = [jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers')].flat();

  return jsonAt(worker, 'progress');
}

describe('status --workers, where a worker stands', () => {
  it('reads a worker stopped mid-row: its rows by their trailer, the files of the row, the markers, the next step', () => {
    commitRow('feat(billing): issue invoice', 'Slice: M1.01');
    startPay();
    agent({});

    const state = progress();

    expect(jsonAt(state, 'phase')).toBe('mid-row');

    expect(jsonAt(state, 'rows')).toEqual([
      { id: 'M1.01', slice: 'Issue invoice', state: 'committed', commit: expect.stringMatching(/^[0-9a-f]{7,}$/) },
      { id: 'M1.02', slice: 'Pay invoice', state: 'in progress' },
    ]);

    expect(jsonAt(state, 'inSlice')).toEqual([PAY, PAY_SPEC]);
    expect(jsonAt(state, 'markers', 'test')).toBe(1);
    expect(jsonAt(state, 'next')).toEqual({ action: 'send-message', to: 'a7' });

    expect(cli(root, 'status', '--workers').stdout).toContain(
      '    state: stopped mid-row #M1.02 (2 files uncommitted, ',
    );

    expect(cli(root, 'status', '--workers').stdout).toMatch(
      /it\.todo\); resume: npx ddd-ts-kit worker-scope billing --resume\n/,
    );
  });

  it('matches a commit without trailer in order with the feat commits of the context', () => {
    commitRow('feat(billing): issue invoice');

    expect(jsonAt(progress(), 'rows')).toEqual([
      expect.objectContaining({ id: 'M1.01', state: 'committed', byOrder: true }),
      expect.objectContaining({ id: 'M1.02', state: 'to do' }),
    ]);

    expect(cli(root, 'worker-scope', 'billing', '--resume').stdout).toMatch(/#M1\.01 committed [0-9a-f]+ \(by order\)/);
  });

  it('asks for a new agent between rows, and for the merge once every row is committed and nothing is left', () => {
    commitRow('feat(billing): issue invoice', 'Slice: M1.01');
    agent({});

    expect(jsonAt(progress(), 'phase')).toBe('between rows');
    expect(jsonAt(progress(), 'next')).toEqual({ action: 'new-agent' });

    write(worktree, PAY, 'export const pay = 1;\n');
    git(worktree, 'add', PAY);
    git(worktree, 'commit', '--quiet', '--message', 'feat(billing): pay invoice', '--message', 'Slice: M1.02');

    expect(jsonAt(progress(), 'phase')).toBe('rows committed');
    expect(jsonAt(progress(), 'next')).toEqual({ action: 'merge' });

    expect(cli(root, 'status', '--workers').stdout).toMatch(
      /state: rows committed \(#M1\.01, #M1\.02\).*; next: merge the branch\n/,
    );
  });

  it('waits while its agent was seen a moment ago, and a new agent once it ran three times or made no progress', () => {
    startPay();
    agent({ lastSeen: new Date().toISOString() });

    expect(jsonAt(progress(), 'next')).toEqual({ action: 'wait' });
    expect(cli(root, 'status', '--workers').stdout).toContain('state: working mid-row #M1.01');

    agent({ run: 3 });

    expect(jsonAt(progress(), 'next')).toEqual({ action: 'new-agent' });

    const head = git(worktree, 'rev-parse', 'HEAD').trim();

    agent({ runStartedAt: new Date(Date.now() + 60_000).toISOString(), runStartHead: head });

    expect(jsonAt(progress(), 'next')).toEqual({ action: 'new-agent' });
  });

  it('says whether the report is current, and what the last verification found', () => {
    startPay();
    write(worktree, '.ddd-ts-kit/report.md', 'Slices done: none yet.\n');

    const verified = { at: OLD, head: null, row: 'M1.02', ok: false, failed: ['tests'], toStage: [PAY] };

    write(worktree, '.ddd-ts-kit/verification.json', JSON.stringify(verified));

    expect(jsonAt(progress(), 'report', 'current')).toBe(true);
    expect(jsonAt(progress(), 'verification')).toMatchObject({ ok: false, failed: ['tests'], changedAfter: 2 });

    expect(cli(root, 'status', '--workers').stdout).toContain(
      'last verify-slice failed: tests, 2 files changed since)',
    );

    const later = new Date(Date.now() + 10_000);

    fs.utimesSync(path.join(worktree, PAY), later, later);

    expect(jsonAt(progress(), 'report', 'current')).toBe(false);
  });
});
