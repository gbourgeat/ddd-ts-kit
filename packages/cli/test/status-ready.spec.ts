import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| M1.02 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --public\` | M1.01 | billing | todo |
| M1.03 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --public\` | M1.01, M1.02 | billing | todo |
| M1.04 | billing | slice | Pay invoice | \`generate command billing PayInvoice --aggregate Invoice --public\` | M1.03 | billing | todo |
`;

const CONTEXT_FILE = 'src/contexts/billing/CONTEXT.md';

let root: string;
let issuing: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');
  issuing = path.join(fs.realpathSync(path.dirname(root)), 'shop-billing');
});

describe('status, whether each row not done can start', () => {
  it('says ready on the trunk when every dependency is done, and waiting with the ids otherwise', () => {
    const rows = jsonAt(cli(root, 'status', '--json').json(), 'slices', 'rows');

    expect(rows).toEqual([
      expect.not.objectContaining({ ready: expect.anything() }),
      expect.objectContaining({ id: 'M1.02', ready: 'trunk', waitingFor: [] }),
      expect.objectContaining({ id: 'M1.03', ready: 'waiting', waitingFor: ['M1.02'] }),
      expect.objectContaining({ id: 'M1.04', ready: 'waiting', waitingFor: ['M1.03'] }),
    ]);

    const text = cli(root, 'status').stdout;

    expect(text).toContain(
      '    #M1.02 billing slice "Issue invoice" (owner billing, depends on M1.01): ready on the trunk\n',
    );

    expect(text).toContain('(owner billing, depends on M1.01, M1.02): waits for #M1.02\n');
  });

  it('keeps a row waiting while the worker briefed on its dependency has no commit ahead of its base', () => {
    expect(cli(root, 'worker-scope', 'billing', '--rows', 'M1.02', '--worktree', issuing, '--no-install').code).toBe(0);

    expect(jsonAt(cli(root, 'status', '--json').json(), 'slices', 'rows')).toContainEqual(
      expect.objectContaining({ id: 'M1.03', ready: 'waiting' }),
    );
  });

  it('says ready on a branch once that worker committed, and only for the rows whose dependencies are all there', () => {
    write(issuing, CONTEXT_FILE, `${read(issuing, CONTEXT_FILE)}\nIssued: sent to the customer.\n`);
    git(issuing, 'commit', '--quiet', '--all', '--message', 'feat(billing): issue invoice');

    const rows = jsonAt(cli(root, 'status', '--json').json(), 'slices', 'rows');

    expect(rows).toContainEqual(expect.objectContaining({ id: 'M1.03', ready: 'branch', waitingFor: ['M1.02'] }));
    expect(rows).toContainEqual(expect.objectContaining({ id: 'M1.04', ready: 'waiting', waitingFor: ['M1.03'] }));
    expect(cli(root, 'status').stdout).toContain('depends on M1.01, M1.02): ready on a branch, once #M1.02 merges\n');
  });
});
