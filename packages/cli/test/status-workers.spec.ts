import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --public\` | | billing | todo |
| M1.02 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --public\` | | billing | todo |
| M1.03 | shipping | slice | Ship | \`generate command shipping Ship --public\` | | shipping | todo |
`;

const SHARED = 'src/contexts/billing/CONTEXT.md';

let root: string;
let issuing: string;
let cancelling: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core', '--context', 'shipping:supporting');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');

  const parent = fs.realpathSync(path.dirname(root));

  issuing = path.join(parent, 'shop-billing-1');
  cancelling = path.join(parent, 'shop-billing-2');
});

describe('status --workers', () => {
  it('says in one line that no worktree holds a worker', () => {
    const status = cli(root, 'status', '--workers');

    expect(status.code).toBe(0);

    expect(status.stdout.trim().split('\n')).toEqual([
      'No worker: no worktree of this repository holds .ddd-ts-kit/worker.json (`npx ddd-ts-kit worker-scope <context>` prepares one).',
    ]);

    expect(cli(root, 'status', '--workers', '--json').json()).toEqual({
      workers: [],
      overlaps: { contexts: [], files: [] },
    });
  });

  it('records in the scope file the rows, the base and the branch next to the context', () => {
    open('M1.01', issuing, 'build/billing-issue');

    expect(JSON.parse(read(issuing, '.ddd-ts-kit/worker.json'))).toEqual({
      context: 'billing',
      rows: ['M1.01'],
      base: 'main',
      baseCommit: git(root, 'rev-parse', 'main').trim(),
      branch: 'build/billing-issue',
    });
  });

  it('shows two workers of one context changing the same file as overlaps', () => {
    open('M1.02', cancelling, 'build/billing-cancel');
    write(issuing, SHARED, `${read(issuing, SHARED)}\nIssued: sent to the customer.\n`);
    git(issuing, 'commit', '--quiet', '--all', '--message', 'docs(billing): issued');
    write(cancelling, SHARED, `${read(cancelling, SHARED)}\nCancelled: no longer due.\n`);
    write(cancelling, 'src/contexts/billing/cancel.ts', 'export {};\n');
    write(issuing, '.ddd-ts-kit/report.md', 'Slices done: none yet.\n');

    const status = cli(root, 'status', '--workers', '--json').json();

    expect(jsonAt(status, 'workers')).toEqual([
      expect.objectContaining({
        worktree: issuing,
        branch: 'build/billing-issue',
        context: 'billing',
        rows: ['M1.01'],
        base: 'main',
        ahead: 1,
        files: [SHARED],
        report: expect.objectContaining({ file: path.join(issuing, '.ddd-ts-kit/report.md') }),
      }),
      expect.objectContaining({
        worktree: cancelling,
        ahead: 0,
        files: [SHARED, 'src/contexts/billing/cancel.ts'],
        report: null,
      }),
    ]);

    expect(jsonAt(status, 'overlaps')).toEqual({
      contexts: [{ context: 'billing', worktrees: [issuing, cancelling] }],
      files: [{ file: SHARED, worktrees: [issuing, cancelling] }],
    });

    const text = cli(root, 'status', '--workers').stdout;

    expect(text).toContain('    context billing, rows #M1.01, base main, 1 commit ahead, dependencies not installed\n');
    expect(text).toContain('  context billing, built by build/billing-issue, build/billing-cancel\n');
    expect(text).toContain(`  ${SHARED}, changed by build/billing-issue, build/billing-cancel`);
  });

  it('reads a scope file written before the rows and the base were recorded, with what it lacks left out', () => {
    write(cancelling, '.ddd-ts-kit/worker.json', '{\n  "context": "billing"\n}\n');

    const workers = jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers');

    const old = Array.isArray(workers)
      ? workers.find((worker) => jsonAt(worker, 'worktree') === cancelling)
      : undefined;

    expect(old).toEqual({
      worktree: cancelling,
      branch: 'build/billing-cancel',
      context: 'billing',
      installed: false,
      files: [SHARED, 'src/contexts/billing/cancel.ts'],
      report: null,
    });

    expect(cli(root, 'status', '--workers').stdout).toContain('2 files changed (uncommitted only');
  });

  it('says which worktree has its dependencies, in JSON and in words', () => {
    fs.mkdirSync(path.join(issuing, 'node_modules'));

    const workers = jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers');

    expect(workers).toEqual([
      expect.objectContaining({ worktree: issuing, installed: true }),
      expect.objectContaining({ worktree: cancelling, installed: false }),
    ]);

    const text = cli(root, 'status', '--workers').stdout;

    expect(text).toContain('    context billing, rows #M1.01, base main, 1 commit ahead\n');
    expect(text).toContain('    context billing, dependencies not installed\n');
  });

  it('leaves status without --workers as it was', () => {
    expect(cli(root, 'status').stdout).toContain('Slices (docs/architecture/slices.md): 3');
  });

  it('shows no standing for a worker whose base names no commit any more', () => {
    write(cancelling, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['M1.02'], base: 'gone' }));

    const workers = jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers');

    const old = Array.isArray(workers)
      ? workers.find((worker) => jsonAt(worker, 'worktree') === cancelling)
      : undefined;

    expect(old).toMatchObject({ base: 'gone', rows: ['M1.02'] });
    expect(old).not.toHaveProperty('ahead');
    expect(old).not.toHaveProperty('behind');
  });
});

function open(row: string, worktree: string, branch: string): void {
  const opened = cli(
    root,
    'worker-scope',
    'billing',
    '--rows',
    row,
    '--worktree',
    worktree,
    '--branch',
    branch,
    '--no-install',
  );

  expect(opened.code).toBe(0);
}
