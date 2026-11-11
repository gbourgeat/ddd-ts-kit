import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { git } from './support/git';
import { commitFiles, mergeTrunk, onBranch, squashInto, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';
const HANDLER = 'src/contexts/billing/pay/handler.ts';
const SLICES = 'docs/architecture/slices.md';
const NOTES = 'docs/notes.md';

const invoice = (...methods: string[]): string =>
  ['export class Invoice {', '  constructor() {}', ...methods.map((method) => `  ${method}`), '}', ''].join('\n');

const row = (id: string, slice: string, status: string): string =>
  `| ${id} | billing | slice | ${slice} | generate command | | billing | ${status} |`;

const table = (...rows: readonly string[]): string =>
  [
    '| # | context | kind | slice | start with | depends on | owner | status |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');

describe('merge-trunk: a branch reused after its squash, what its landed base holds', () => {
  it('keeps a row of the slices file the branch added before its landing, when the trunk took the code without it', () => {
    const root = trunkRepository({ [INVOICE]: invoice(), [SLICES]: table(row('US1.01', 'Issue invoice', 'todo')) });

    onBranch(root, 'build/billing');

    const landed = commitFiles(
      root,
      {
        [INVOICE]: invoice('issue() { return 1; }'),
        [SLICES]: table(row('US1.01', 'Issue invoice', 'done'), row('US1.02', 'Pay invoice', 'todo')),
      },
      'row 1: issue',
    );

    squashInto(root, 'build/billing', {
      message: 'feat(billing): issue (#1)',
      files: { [SLICES]: table(row('US1.01', 'Issue invoice', 'done')) },
    });

    commitFiles(root, { [NOTES]: 'Unrelated.\n' }, 'docs: notes (#2)');
    onBranch(root, 'build/billing');
    commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }', 'pay() { return 2; }') }, 'row 2: pay');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      base: { commit: landed, evidence: 'landed' },
      conflicts: { ownDiff: 0, automatic: 0, forYou: 0 },
      automatic: [{ file: SLICES, kind: 'slices' }],
      lostLines: { errors: [] },
    });

    expect(read(root, SLICES)).toBe(
      table(row('US1.01', 'Issue invoice', 'done'), row('US1.02', 'Pay invoice', 'todo')),
    );
  });

  it('takes for landed the merge of the trunk the branch made before its squash, though the trunk changed since what that merge brought', () => {
    const root = trunkRepository({ [INVOICE]: invoice(), [NOTES]: 'Invoices are issued monthly.\n' });

    onBranch(root, 'build/billing');
    commitFiles(root, { [HANDLER]: 'export const payHandler = 1;\n' }, 'row 1: pay handler');
    onBranch(root, 'main');
    commitFiles(root, { [NOTES]: 'Invoices are issued weekly.\n' }, 'docs: weekly (#2)');
    onBranch(root, 'build/billing');
    git(root, 'merge', '--quiet', '--no-ff', '--message', 'Merge main into build/billing', 'main');

    const merged = git(root, 'rev-parse', 'HEAD').trim();
    const squash = squashInto(root, 'build/billing', { message: 'feat(billing): pay handler (#3)' });

    commitFiles(root, { [NOTES]: 'Invoices are issued daily.\n' }, 'docs: daily (#4)');
    onBranch(root, 'build/billing');
    commitFiles(root, { [INVOICE]: invoice('pay() { return 2; }') }, 'row 2: pay');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      base: { commit: merged, evidence: 'landed', landedAs: { commit: squash } },
      conflicts: { ownDiff: 0, forYou: 0 },
      lostLines: { errors: [] },
    });

    expect(read(root, NOTES)).toBe('Invoices are issued daily.\n');
    expect(read(root, INVOICE)).toBe(invoice('pay() { return 2; }'));
  });
});
