import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { committedProject } from './support/committed-project';
import { jsonAt } from './support/json-at';
import { commitFiles, squashInto } from './support/trunk-history';

const SLICES_FILE = 'docs/architecture/slices.md';

const slices = (issue: string): string => `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --public\` | | billing | ${issue} |
| M1.02 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --public\` | M1.01 | billing | todo |
`;

const ISSUE = 'src/contexts/billing/issue.ts';

let root: string;
let worktree: string;
let squash: string;

/** The worker of billing issues invoices and marks its row done; the conductor squash-merges its branch, leaving the row of the trunk as it was. */
beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core');
  write(root, SLICES_FILE, slices('todo'));
  commitFiles(root, {}, 'docs: slices');
  worktree = path.join(fs.realpathSync(path.dirname(root)), 'shop-billing');

  expect(cli(root, 'worker-scope', 'billing', '--rows', 'M1.01', '--worktree', worktree, '--no-install').code).toBe(0);

  commitFiles(
    worktree,
    { [ISSUE]: 'export const issue = 1;\n', [SLICES_FILE]: slices('done') },
    'feat(billing): issue an invoice',
  );

  commitFiles(root, { 'docs/notes.md': 'Unrelated.\n' }, 'docs: notes (#2)');

  squash = squashInto(root, 'build/billing', {
    message: 'feat(billing): issue an invoice (#3)',
    files: { [SLICES_FILE]: slices('todo') },
  });
});

describe("status, once a worker's branch landed on its base", () => {
  it('counts nothing more ahead nor changed, names the commit that took it in, and previews the next merge', () => {
    const [worker] = [jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers')].flat();

    expect(worker).toMatchObject({
      worktree,
      ahead: 0,
      behind: 2,
      files: [],
      landed: { commit: squash, subject: 'feat(billing): issue an invoice (#3)', rows: ['M1.01'] },
      mergePreview: { conflicts: 0, files: [] },
    });

    const text = cli(root, 'status', '--workers').stdout;

    expect(text).toContain(
      '    context billing, rows #M1.01, base main, 0 commits ahead, 2 behind, dependencies not installed\n',
    );

    expect(text).toContain(
      `    landed as ${squash.slice(0, 7)} "feat(billing): issue an invoice (#3)" (rows #M1.01)\n`,
    );

    expect(text).toContain('    merge-trunk would merge the base without a conflict\n');
    expect(text).toContain('    0 files changed (since it landed on main)');
  });

  it('tells the conductor that a row landed but is not marked done, and no longer counts it on its way on a branch', () => {
    const text = cli(root, 'status').stdout;

    expect(text).toContain(
      `  #M1.01 landed on the trunk (${squash.slice(0, 7)}) but is not marked done: mark it done in ${SLICES_FILE}\n`,
    );

    expect(text).toContain(
      '    #M1.02 billing slice "Cancel invoice" (owner billing, depends on M1.01): waits for #M1.01\n',
    );
  });

  it('counts the next row of the reused branch from where it landed, and previews its conflicts with the base', () => {
    commitFiles(worktree, { 'docs/notes.md': 'Changed on the branch.\n' }, 'feat(billing): cancel an invoice');

    const [worker] = [jsonAt(cli(root, 'status', '--workers', '--json').json(), 'workers')].flat();

    expect(worker).toMatchObject({
      ahead: 1,
      files: ['docs/notes.md'],
      mergePreview: { conflicts: 1, files: ['docs/notes.md'] },
    });

    expect(cli(root, 'status', '--workers').stdout).toContain(
      '    merge-trunk would leave 1 conflicted file: docs/notes.md\n',
    );

    expect(read(worktree, ISSUE)).toBe('export const issue = 1;\n');
  });
});
