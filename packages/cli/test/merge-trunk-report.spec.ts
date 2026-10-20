import { describe, expect, it } from 'vitest';
import { forYouEntry } from '../src/merge/for-you-entry.js';
import { formatMergeReport } from '../src/merge/format-merge-report.js';
import type { MergeReport } from '../src/merge/merge-report.js';
import { migrationsAt } from '../src/merge/migrations-at.js';
import { NEXT_STEPS } from '../src/merge/next-steps.js';
import { read } from './helpers.js';
import { commitFiles, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history.js';

const TRUNK = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

/** A report stopped after the conflicts, with every section filled. */
const STOPPED: MergeReport = {
  status: 'stopped',
  branch: 'build/billing',
  trunk: { ref: 'origin/main', commit: TRUNK },
  base: { commit: BASE, evidence: 'option' },
  conflicts: { plainMerge: 2, ownDiff: 1, automatic: 0, forYou: 1 },
  automatic: [],
  forYou: [
    {
      file: 'src/contexts/billing/invoice.ts',
      kind: 'source',
      why: 'a conflict outside any generated region',
      hunks: ['3-9'],
      ours: { branch: 'build/billing', rows: [], change: 'adds 1 line: pay() {}' },
      theirs: {
        ref: 'origin/main',
        commits: ['1111111 one', '2222222 two', '3333333 three', '4444444 four'],
        change: 'removes 1 line',
      },
      advice: 'both sides change the same lines: write the lines that keep the intent of each.',
    },
  ],
  migrations: [
    '20261015101500_working-add-invoices renamed 20261017100000_add-invoices, after the last migration of the trunk',
  ],
  regenerate: { status: 'failed', output: 'line one\nline two' },
  lostLines: { errors: [], warnings: [], accepted: [] },
  leftOut: ['notes.md'],
  stop: "changed paths that are not the merge's",
  next: NEXT_STEPS.leftOut,
};

describe('merge-trunk: the report in words', () => {
  it('names a base given by --since, the commits of the trunk past three, the migrations, a failed regenerate and the paths left out', () => {
    const text = formatMergeReport(STOPPED);

    expect(text).toContain(`base ${BASE.slice(0, 7)}: given by --since`);
    expect(text).toContain('settled by you: src/contexts/billing/invoice.ts');
    expect(text).toContain('migrations:\n  20261015101500_working-add-invoices renamed');
    expect(text).toContain('regenerate: failed\n  line one\n  line two');
    expect(text).toContain('lost lines: none lost');
    expect(text).toContain('left out (not paths of the merge, they block its commit):\n  notes.md');
    expect(text).toContain("stopped: changed paths that are not the merge's");
  });

  it('lists the hunks for a person while the merge waits for them, the commits of the trunk past three counted', () => {
    const text = formatMergeReport({ ...STOPPED, next: NEXT_STEPS.resolve });

    expect(text).toContain(
      'theirs (origin/main since bbbbbbb, 1111111 "one", 2222222 "two", 3333333 "three" and 1 more): removes 1 line',
    );

    expect(text).toContain('    ours  (build/billing): adds 1 line: pay() {}');
  });

  it('says a recorded base was found on the trunk, and shows the warnings of the gate', () => {
    const warning = { kind: 'revived', file: 'a.ts', line: 3, side: 'ours', text: 'legacy()' } as const;

    const text = formatMergeReport({
      ...STOPPED,
      base: { commit: BASE, evidence: 'recorded' },
      forYou: [],
      regenerate: { status: 'ok' },
      lostLines: { errors: [], warnings: [warning], accepted: [] },
    });

    expect(text).toContain('the base recorded for this worker, its lines found on the trunk');
    expect(text).toContain('lost lines: none lost, 1 warning(s)');
    expect(text).toContain('regenerate: ok');
  });

  it('tells what each side did when one only removes lines and the other keeps the base', () => {
    const long = `  ${'x'.repeat(90)}`;

    const entry = forYouEntry(
      {
        file: 'a.ts',
        kind: 'source',
        content: undefined,
        settled: false,
        how: 'a conflict outside any generated region',
        blocks: [
          {
            kind: 'conflict' as const,
            ours: ['keep'],
            base: ['keep', 'drop'],
            theirs: ['keep', 'drop', long],
            raw: ['', '', '', '', '', ''],
            line: 4,
          },
        ],
      },
      { top: '.', branch: 'build/billing', rows: ['M1.02'], trunk: { ref: 'main', commit: 'HEAD' }, base: 'HEAD' },
    );

    expect(entry).toMatchObject({
      hunks: ['4-9'],
      ours: { change: 'removes 1 line' },
      theirs: { change: `adds 1 line: ${'x'.repeat(69)}...` },
    });

    expect(entry.advice).toContain('both sides change the same lines');
  });
});

describe('merge-trunk: the migrations of a commit, and a derived file the trunk deleted', () => {
  it('reads migration files and Prisma folders, the lock file of Prisma and declaration files aside', () => {
    const root = trunkRepository({
      'migrations/20261015101500_add-invoices.js': 'export const up = () => {};\n',
      'migrations/20261015101500_add-invoices.d.ts': 'export {};\n',
      'migrations/notes.md': 'notes\n',
      'prisma/migrations/migration_lock.toml': 'provider = "postgresql"\n',
      'prisma/migrations/20261015101500_add_invoices/migration.sql': 'CREATE TABLE "invoices" ();\n',
    });

    expect(migrationsAt(root, 'HEAD', { folder: 'migrations', directories: false })).toEqual([
      { name: '20261015101500_add-invoices', file: 'migrations/20261015101500_add-invoices.js' },
    ]);

    expect(migrationsAt(root, 'HEAD', { folder: 'prisma/migrations', directories: true })).toEqual([
      { name: '20261015101500_add_invoices', file: 'prisma/migrations/20261015101500_add_invoices/migration.sql' },
    ]);
  });

  it('keeps the version of a client the branch raised when the trunk changed its package.json too', () => {
    const manifest = (version: string, description: string): string =>
      `${JSON.stringify({ name: '@shop/billing-client', version, description }, null, 2)}\n`;

    const file = 'clients/billing/package.json';
    const root = trunkRepository({ [file]: manifest('1.2.0', 'Typed client of Billing.') });

    onBranch(root, 'build/billing');
    commitFiles(root, { [file]: manifest('1.3.0', 'Typed client of Billing.') }, 'chore(billing): client 1.3.0');
    onBranch(root, 'main');
    commitFiles(root, { [file]: manifest('1.2.1', 'Typed client of Billing, with refunds.') }, 'feat: refunds (#2)');
    onBranch(root, 'build/billing');

    const how =
      'client package.json: trunk side, version 1.3.0 kept, the higher of 1.3.0 on this branch and 1.2.1 on the trunk';

    expect(mergeTrunk(root).stdout).toContain(`automatic:\n  ${file}  ${how}`);
    expect(read(root, file)).toBe(manifest('1.3.0', 'Typed client of Billing, with refunds.'));
  });

  it('deletes a derived file the trunk deleted while the branch changed it', () => {
    const root = trunkRepository({ 'clients/billing.ts': 'export const client = 1;\n' });

    onBranch(root, 'build/billing');
    commitFiles(root, { 'clients/billing.ts': 'export const client = 2;\n' }, 'feat(billing): client');
    onBranch(root, 'main');
    commitFiles(root, { 'clients/billing.ts': null }, 'chore: no client (#2)');
    onBranch(root, 'build/billing');

    expect(mergeTrunk(root, '--json').json()).toMatchObject({
      status: 'committed',
      automatic: [{ file: 'clients/billing.ts', kind: 'derived' }],
    });
  });
});
