import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { git } from './support/git';
import { INVOICE, SLICES } from './support/invoicing-merge';
import { jsonAt } from './support/json-at';
import { commit, type Files, mergeRepository, mergeWith } from './support/merge-repository';

const PAYMENT = 'src/contexts/billing/payment.ts';
const payment = 'export class Payment {\n  settle(amount: Money): void {}\n}\n';
const lines = (...body: readonly string[]): string => ['export class Invoice {', ...body, '}', ''].join('\n');

const row = (id: string, slice: string, status: string): string =>
  `| ${id} | billing | slice | ${slice} | generate command | | billing | ${status} |`;

const table = (...rows: readonly string[]): string =>
  [
    '| # | context | kind | slice | start with | depends on | owner | status |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');

function kinds(root: string): string[] {
  const findings = jsonAt(cli(root, 'verify-merge', 'HEAD', '--json').json(), 'merges', '0', 'errors');

  return Array.isArray(findings) ? findings.map((finding) => String(jsonAt(finding, 'kind'))) : [];
}

/** Merges main with `resolution`, the merge recorded as computed from the head of the branch: a base too new. */
function mergedFromHead(root: string, resolution: Files): string {
  const head = git(root, 'rev-parse', 'HEAD').trim();

  mergeWith(root, resolution, `Merge main into build/billing\n\nMerge-Base: ${head}`);

  return head;
}

describe('verify-merge, a file of the branch the merge dropped, whatever the base', () => {
  const cancelled = { [INVOICE]: lines('  issue() {}', '  cancel() {}') };

  it('reports a file the branch added, that the trunk never touched and the result lacks, though the base holds it', () => {
    const root = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}') },
      ours: { [PAYMENT]: payment },
      theirs: cancelled,
    });

    mergedFromHead(root, { [PAYMENT]: null });

    const answer = cli(root, 'verify-merge', 'HEAD', '--json').json();

    expect(jsonAt(answer, 'merges', '0', 'baseFrom')).toBe('trailer');

    expect(jsonAt(answer, 'merges', '0', 'errors')).toEqual([
      expect.objectContaining({ kind: 'file-deleted', file: PAYMENT, side: 'ours', line: 1 }),
    ]);

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(
      `files deleted by the merge:\n    ${PAYMENT} (ours)  added on this side, its path never touched by the other: missing from the result`,
    );
  });

  it('reports nothing when the result holds the file under another path, or when the trunk had that path and removed it', () => {
    const moved = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}') },
      ours: { [PAYMENT]: payment },
      theirs: cancelled,
    });

    const removed = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}') },
      ours: { [PAYMENT]: payment },
      theirs: { [PAYMENT]: payment },
    });

    mergedFromHead(moved, { [PAYMENT]: null, 'src/contexts/payments/payment.ts': payment });
    git(removed, 'switch', '--quiet', 'main');
    commit(removed, { [PAYMENT]: null }, 'refactor(billing): payments leave the context (#3)');
    git(removed, 'switch', '--quiet', 'build/billing');
    mergedFromHead(removed, { [PAYMENT]: null });

    expect(kinds(moved)).toEqual([]);
    expect(kinds(removed)).toEqual([]);
  });
});

describe('verify-merge, the rows of a base the trunk never held', () => {
  it('reports a row the result dropped and a status it took back from the trunk, when the fork held neither', () => {
    const forked = table(row('US1.01', 'Issue invoice', 'todo'));

    const root = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}'), [SLICES]: forked },
      ours: { [SLICES]: table(row('US1.01', 'Issue invoice', 'done'), row('US1.02', 'Pay invoice', 'todo')) },
      theirs: { [INVOICE]: lines('  issue() {}', '  cancel() {}') },
    });

    const head = mergedFromHead(root, { [SLICES]: forked });

    expect(jsonAt(cli(root, 'verify-merge', 'HEAD', '--json').json(), 'merges', '0', 'base')).toBe(head);
    expect(kinds(root)).toEqual(['row-not-done', 'row-lost']);

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(
      `rows gone:\n    ${SLICES}:4 (ours)  #US1.02 Pay invoice`,
    );
  });

  it('leaves to the trunk a row it deleted and a row it reopened since the fork', () => {
    const root = mergeRepository({
      base: {
        [INVOICE]: lines('  issue() {}'),
        [SLICES]: table(row('US1.01', 'Issue invoice', 'done'), row('US1.03', 'Cancel invoice', 'todo')),
      },
      ours: { [INVOICE]: lines('  issue() {}', '  pay() {}') },
      theirs: { [SLICES]: table(row('US1.01', 'Issue invoice', 'todo')) },
    });

    mergeWith(root, {});

    expect(kinds(root)).toEqual([]);
  });
});
