import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers.js';
import { commitFiles } from './support/commit-files.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const CONFIG = JSON.stringify({
  contexts: {
    billing: { classification: 'core' },
    payments: { classification: 'supporting' },
    catalog: { classification: 'generic' },
  },
});

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| M1.02 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | M1.01 | billing | done |
| M1.03 | payments | slice | Record payment | \`generate command payments RecordPayment --aggregate Payment --permission payment.record\` | M1.02 | payments | done |
| US2.01 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --permission invoice.cancel\` | M1.02 | billing | in progress |
| US2.02 | catalog | slice | List products | \`generate query catalog ListProducts --permission product.list\` | | catalog | todo |
`;

const BILLING = 'src/contexts/billing';
const ISSUE = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const CANCEL = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const PAYMENT = 'src/contexts/payments/domain/aggregates/payment.aggregate.ts';
const REVIEW = 'docs/architecture/reviews/invoices.md';

/** Two stories in billing: M1 done, US2 open, with markers attributed by commit, by text, and to no row. */
function twoStories(): string {
  const root = tempDir('story-check');

  git(root, 'init', '--quiet');

  commitFiles(root, {
    message: 'chore: plan the slices',
    files: { 'ddd-ts-kit.config.json': CONFIG, 'docs/architecture/slices.md': SLICES },
  });

  commitFiles(root, {
    message: 'feat(billing): issue invoice\n\nSlice: M1.02',
    files: { [ISSUE]: 'export class IssueInvoiceHandler {\n  // TODO(domain): the rounding of a total.\n}\n' },
  });

  commitFiles(root, {
    message: 'feat(billing): cancel invoice, row US2.01',
    files: {
      [CANCEL]: 'export class CancelInvoiceHandler {\n  // TODO(review): log the reason of a cancellation.\n}\n',
    },
  });

  commitFiles(root, {
    message: 'chore: tidy the specs',
    files: {
      [SPEC]: "it.todo('refuses an invoice without lines');\n",
      [REVIEW]:
        '# Invoices\n\n- TODO(review): #M1.01 name the total after its term.\n- TODO(review): M1.015 is no row.\n',
      [PAYMENT]: 'export class Payment {\n  // TODO(platform): the provider of a refund.\n}\n',
    },
  });

  return root;
}

describe('story-check, refused', () => {
  it('refuses a project without slices table, then a code no row carries', () => {
    const empty = tempDir('story-check');

    write(empty, 'ddd-ts-kit.config.json', CONFIG);

    expect(cli(empty, 'story-check', 'M1').code).toBe(2);

    expect(cli(empty, 'story-check', 'M1').stderr).toContain(
      'docs/architecture/slices.md is missing or has no slices table',
    );

    const root = tempDir('story-check');

    write(root, 'ddd-ts-kit.config.json', CONFIG);
    write(root, 'docs/architecture/slices.md', SLICES);

    const unknown = cli(root, 'story-check', 'M9');

    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('No row of docs/architecture/slices.md belongs to the story or milestone "M9"');
    expect(unknown.stderr).toContain('Use one of: M1, US2.');
    expect(cli(root, 'story-check', 'M1.03').stderr).toContain('#M1.03 is a row: its story is M1.');
    expect(jsonAt(cli(root, 'story-check', 'M9', '--json').json(), 'error', 'message')).toContain('"M9"');
    expect(cli(root, 'story-check').code).toBe(2);
  });
});

describe('story-check', () => {
  let root: string;

  beforeAll(() => {
    root = twoStories();
  });

  it('refuses a done story for its own markers only, each with why it is its own', () => {
    const check = cli(root, 'story-check', 'M1');

    expect(check.code).toBe(1);
    expect(check.stdout).toContain('M1 cannot close: every row done, 3 markers of its own left.');

    expect(check.stdout).toMatch(
      / {2}src\/contexts\/billing\/.*issue-invoice\.handler\.ts:2 {2}the rounding of a total\. {2}\(written by [0-9a-f]{7} Slice: M1\.02\)/,
    );

    expect(check.stdout).toContain(`  ${REVIEW}:3  #M1.01 name the total after its term.  (names #M1.01)`);
    expect(check.stdout).toContain(`  ${PAYMENT}:2  the provider of a refund.  (no other open story in payments)`);
    expect(check.stdout).not.toContain('M1.015');

    expect(check.stdout).toContain(
      `  ${SPEC}:1  it.todo  refuses an invoice without lines  (unattributed, may belong to open US2`,
    );

    expect(check.stdout).toContain('Not blocking: 1 marker of these contexts belongs to rows of US2.');

    const json = cli(root, 'story-check', 'M1', '--json').json();

    expect(jsonAt(json, 'markers', '0', 'attribution')).toMatchObject({
      by: 'commit',
      rows: ['M1.02'],
      commit: { trailer: true },
    });

    expect(jsonAt(json, 'others', '0', 'attribution')).toMatchObject({
      by: 'commit',
      rows: ['US2.01'],
      commit: { trailer: false },
    });
  });

  it('is named by status with its own markers only', () => {
    expect(cli(root, 'status').stdout).toContain(
      '  story M1: every row done, 3 markers left: npx ddd-ts-kit story-check M1',
    );

    expect(jsonAt(cli(root, 'status', '--json').json(), 'slices', 'unclosed')).toEqual([
      { story: 'M1', markers: 3, command: 'npx ddd-ts-kit story-check M1' },
    ]);
  });

  it('counts a marker not committed in a worker worktree to the rows of that worker', () => {
    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['M1.02'] }));
    write(root, `${BILLING}/domain/aggregates/invoice.aggregate.ts`, '// TODO(review): split the total.\n');

    expect(cli(root, 'story-check', 'M1').stdout).toContain(
      'split the total.  (not committed, in the worktree of #M1.02)',
    );

    fs.rmSync(path.join(root, '.ddd-ts-kit'), { recursive: true });
    fs.rmSync(path.join(root, BILLING, 'domain'), { recursive: true });
  });

  it('closes once its own markers are settled, listing those of the open story without blocking', () => {
    commitFiles(root, {
      message: 'fix: settle the remarks of M1',
      files: {
        [ISSUE]: 'export class IssueInvoiceHandler {}\n',
        [REVIEW]: '# Invoices\n',
        [PAYMENT]: 'export class Payment {}\n',
      },
    });

    const check = cli(root, 'story-check', '#M1');

    expect(check.code).toBe(0);

    expect(check.stdout.split('\n')[0]).toBe(
      'M1 can close: its 3 rows done, no marker of its own left in billing, payments.',
    );

    expect(check.stdout).toContain('Not blocking, unattributed (1)');
    expect(cli(root, 'status').stdout).not.toContain('story M1');
  });

  it('blocks on every marker of its contexts with --strict, and lists the rows of a story not done', () => {
    const strict = cli(root, 'story-check', 'M1', '--strict');

    expect(strict.code).toBe(1);
    expect(strict.stdout).toContain('M1 cannot close: every row done, 2 markers of its own left.');
    expect(strict.stdout).toContain('(in billing, --strict)');

    const open = cli(root, 'story-check', 'US2');

    expect(open.code).toBe(1);
    expect(open.stdout).toContain('US2 cannot close: 2 rows not done');

    expect(open.stdout).toContain(
      '  #US2.01 billing "Cancel invoice": in progress\n  #US2.02 catalog "List products": todo',
    );

    expect(open.stdout).toContain('log the reason of a cancellation.  (written by');
  });
});
