import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --public\` | | billing | todo |
| M1.02 | billing | slice | Pay invoice | \`generate command billing PayInvoice --public\` | | billing | todo |
| M1.03 | billing | slice | Refund invoice | \`generate command billing RefundInvoice --public\` | | billing | todo |

- #M1.02: a paid invoice is never paid again: InvoiceAlreadyPaid.
`;

const ISSUE = 'src/contexts/billing/domain/issue.ts';
const PAY = 'src/contexts/billing/domain/pay.ts';
const OLD = '2020-01-01T00:00:00.000Z';

let root: string;
let worktree: string;

beforeEach(() => {
  root = committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');
  worktree = path.join(fs.realpathSync(root), '.worktrees', 'billing');
  expect(cli(root, 'worker-scope', 'billing', '--rows', 'M1.01,M1.02,M1.03', '--no-install').code).toBe(0);
  write(worktree, ISSUE, 'export const issued = 1;\n');
  git(worktree, 'add', ISSUE);
  git(worktree, 'commit', '--quiet', '--message', 'feat(billing): issue invoice', '--message', 'Slice: M1.01');
  write(worktree, PAY, '// TODO(domain): a paid invoice is never paid again.\nexport const pay = 1;\n');
  write(worktree, '.ddd-ts-kit/report.md', '# Report\n\nSlices done: #M1.01.\nNot done: #M1.02, started.\n');
});

function agent(record: Record<string, unknown> = {}): void {
  const base = { agentId: 'a7', run: 1, runStartedAt: OLD, runStartHead: null, lastSeen: OLD, toolCalls: 81 };

  write(
    worktree,
    '.ddd-ts-kit/agent.json',
    JSON.stringify({ ...base, rowCosts: { 'M1.01': 40 }, lastStop: null, ...record }),
  );
}

describe('worker-scope --resume', () => {
  it('resumes the agent of a worker stopped mid-row with SendMessage, and holds a briefing for a new one', () => {
    agent();

    const resume = cli(root, 'worker-scope', 'billing', '--resume');

    expect(resume.code).toBe(0);
    expect(resume.stdout).toMatch(/^worker build\/billing {2}\/.*\.worktrees\/billing {2}\(base main\)$/m);
    expect(resume.stdout).toMatch(/^rows: #M1\.01 committed [0-9a-f]+, #M1\.02 in progress, #M1\.03 to do$/m);
    expect(resume.stdout).toContain(`#M1.02: 1 file uncommitted (${PAY}), `);
    expect(resume.stdout).toContain('agent: a7, run 1, 81 tool calls counted');
    expect(resume.stdout).toContain('next: SendMessage to a7:\n---\nContinue row #M1.02 (Pay invoice) in ');
    expect(resume.stdout).toContain('; do not start #M1.03.\nCommitted: #M1.01. Left modified by you: ');

    expect(resume.stdout).toContain(
      'Next: finish #M1.02, `npx ddd-ts-kit verify-slice billing --since main` until it passes, commit with the command it prints',
    );

    const briefing = resume.stdout.split('launch a new context-builder with this briefing:\n---\n')[1] ?? '';

    expect(briefing).toContain(
      '- #M1.02 Pay invoice: `generate command billing PayInvoice --public` ; rules: a paid invoice',
    );

    expect(briefing).not.toContain('#M1.03 Refund invoice');
    expect(briefing).toContain(`Resume: row #M1.02 was started by an earlier agent.`);
    expect(briefing).toContain(`regenerate, delete or reset them: ${PAY}.`);
    expect(briefing).toContain('Start with `npx ddd-ts-kit todo billing` and `verify-slice`, not with the generators.');
    expect(briefing).toContain('> Not done: #M1.02, started.');
  });

  it('asks for a new agent without a recorded agent, after three runs, and with --fresh', () => {
    const none = cli(root, 'worker-scope', 'billing', '--resume', '--json').json();

    expect(jsonAt(none, 'next')).toEqual({ action: 'new-agent' });
    expect(jsonAt(none, 'sendMessage')).toBeNull();
    expect(String(jsonAt(none, 'briefing'))).toContain('Resume: row #M1.02');

    agent({ run: 3 });

    expect(jsonAt(cli(root, 'worker-scope', 'billing', '--resume', '--json').json(), 'next')).toEqual({
      action: 'new-agent',
    });

    agent();

    const fresh = cli(root, 'worker-scope', 'billing', '--resume', '--fresh');

    expect(fresh.stdout).toContain('next: launch a new context-builder with this briefing:\n---\n');
    expect(fresh.stdout).not.toContain('SendMessage to');
  });

  it('gives its data in JSON, and a note when the agent was seen a moment ago', () => {
    agent({ lastSeen: new Date().toISOString() });

    const resume = cli(root, 'worker-scope', 'billing', '--resume', '--json').json();

    expect(Object.keys(resume as object)).toEqual(
      expect.arrayContaining(['progress', 'next', 'sendMessage', 'briefing', 'notes', 'worktree']),
    );

    expect(jsonAt(resume, 'next')).toEqual({ action: 'send-message', to: 'a7' });
    expect(jsonAt(resume, 'sendMessage', 'to')).toBe('a7');
    expect(String(jsonAt(resume, 'sendMessage', 'message'))).toContain('Continue row #M1.02 (Pay invoice)');

    expect(jsonAt(resume, 'notes')).toEqual([
      expect.stringContaining('resume it only once its stop notification arrived'),
    ]);
  });

  it('quotes a long report up to two hundred words, and says when the earlier agent left none', () => {
    const words = Array.from({ length: 150 }, (_, index) => `w${index}`).join(' ');

    write(worktree, '.ddd-ts-kit/report.md', `# Report\n\n${words}\n${words}\nnever quoted\n`);

    const quoted = String(jsonAt(cli(root, 'worker-scope', 'billing', '--resume', '--json').json(), 'briefing'));

    expect(quoted).toContain(`> ${words}\n> ${words.split(' ').slice(0, 48).join(' ')} (...)`);
    expect(quoted).not.toContain('never quoted');

    fs.rmSync(path.join(worktree, '.ddd-ts-kit/report.md'));

    expect(String(jsonAt(cli(root, 'worker-scope', 'billing', '--resume', '--json').json(), 'briefing'))).toContain(
      'It left no report.',
    );
  });

  it('creates and rewrites nothing', () => {
    agent();

    const scope = read(worktree, '.ddd-ts-kit/worker.json');
    const status = git(worktree, 'status', '--porcelain', '--ignored');
    const branches = git(root, 'branch', '--list');

    cli(root, 'worker-scope', 'billing', '--resume');

    expect(read(worktree, '.ddd-ts-kit/worker.json')).toBe(scope);
    expect(git(worktree, 'status', '--porcelain', '--ignored')).toBe(status);
    expect(git(root, 'branch', '--list')).toBe(branches);
    expect(git(root, 'worktree', 'list')).not.toContain('.worktrees/shipping');
  });

  it('refuses a context no worktree builds, and names the worktrees of a context two workers build', () => {
    const none = cli(root, 'worker-scope', 'shipping', '--resume');

    expect(none.code).toBe(2);
    expect(none.stderr).toContain('No worktree of this repository builds shipping.');

    const other = path.join(path.dirname(worktree), 'billing-2');

    expect(
      cli(
        root,
        'worker-scope',
        'billing',
        '--rows',
        'M1.03',
        '--worktree',
        other,
        '--branch',
        'build/b2',
        '--no-install',
      ).code,
    ).toBe(0);

    const two = cli(root, 'worker-scope', 'billing', '--resume');

    expect(two.code).toBe(2);
    expect(two.stderr).toContain(`2 worktrees build billing: ${worktree}, ${other}.`);
    expect(two.stderr).toContain('--resume --worktree <path>');
    expect(cli(root, 'worker-scope', 'billing', '--resume', '--worktree', other).code).toBe(0);

    expect(cli(root, 'worker-scope', 'billing', '--resume', '--branch', 'build/billing').stdout).toContain(
      '#M1.02 in progress',
    );
  });
});
