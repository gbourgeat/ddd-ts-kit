import { describe, expect, it } from 'vitest';
import { CliError } from '../src/cli-error.js';
import { mergeTrunk as mergeTrunkIn } from '../src/merge/merge-trunk.js';
import { exists, read } from './helpers.js';
import { git } from './support/git.js';
import {
  commitFiles,
  lastMessage,
  mergeTrunk,
  merging,
  onBranch,
  parents,
  squashInto,
  trunkRepository,
  workerFile,
} from './support/trunk-history.js';

const OPENAPI = 'openapi/openapi.yaml';
const INVOICE = 'src/contexts/billing/invoice.ts';
/** The generated declarations of a role folder: derived, so left out of the patch a branch is recognised by. */
const DECLARATIONS = 'src/contexts/billing/application/commands/commands.declarations.ts';
const HANDLER = 'src/contexts/billing/pay/handler.ts';

const openapi = (...paths: string[]): string =>
  ['paths:', '  /accounts:', '    get: list', ...paths, '  /zeta:', '    get: z', ''].join('\n');

const invoice = (...methods: string[]): string =>
  ['export class Invoice {', '  constructor() {}', ...methods.map((method) => `  ${method}`), '}', ''].join('\n');

const declarations = (...names: string[]): string =>
  ['export const declarations = [', '  Invoice,', ...names.map((name) => `  ${name},`), '];', ''].join('\n');

const ISSUE = ['  /invoices:', '    post: issue'];
const PAY = ['  /invoices/pay:', '    post: pay'];
const PEOPLE = ['  /people:', '    get: people'];

/**
 * E1: build/billing-1 issues then cancels (A1, A2); build/billing-2 is stacked on A2 and pays (B1,
 * B2); a review fix A3 rewrites a line of A1 after B was cut; another pull request changes the
 * contract on main; then build/billing-1 is squash-merged. build/billing-2 is checked out.
 */
function stacked({ reviewFix, extra = {} }: { reviewFix: boolean; extra?: Record<string, string> }): {
  root: string;
  a2: string;
  squash: string;
} {
  const root = trunkRepository({ [OPENAPI]: openapi(), [INVOICE]: invoice(), [DECLARATIONS]: declarations() });

  onBranch(root, 'build/billing-1');

  commitFiles(
    root,
    {
      [OPENAPI]: openapi(...ISSUE),
      [DECLARATIONS]: declarations('IssueInvoice'),
      [INVOICE]: invoice('issue() { return 1; }'),
    },
    'A1 issue',
  );

  const a2 = commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }', 'cancel() { return 0; }') }, 'A2 cancel');

  onBranch(root, 'build/billing-2');

  commitFiles(
    root,
    {
      [OPENAPI]: openapi(...ISSUE, ...PAY),
      [DECLARATIONS]: declarations('IssueInvoice', 'PayInvoice'),
      [INVOICE]: invoice('issue() { return 1; }', 'cancel() { return 0; }', 'pay() { return 2; }'),
    },
    'B1 pay',
  );

  commitFiles(root, { [HANDLER]: 'export const payHandler = 1;\n' }, 'B2 pay handler');

  const issue = reviewFix ? 'issue(): number { return 1; }' : 'issue() { return 1; }';

  if (reviewFix) {
    onBranch(root, 'build/billing-1');
    commitFiles(root, { [INVOICE]: invoice(issue, 'cancel() { return 0; }') }, 'A3 review fix');
  }

  onBranch(root, 'main');
  commitFiles(root, { [OPENAPI]: openapi(...PEOPLE) }, 'feat(people): list people (#2)');

  const squash = squashInto(root, 'build/billing-1', {
    message: 'feat(billing): issue and cancel (#1)',
    files: { [OPENAPI]: openapi(...ISSUE, ...PEOPLE), [INVOICE]: invoice(issue, 'cancel() { return 0; }'), ...extra },
  });

  onBranch(root, 'build/billing-2');

  return { root, a2, squash };
}

describe('merge-trunk: the base a merge is computed from', () => {
  it('finds where the branch it was stacked on landed, review fix included, and leaves one derived conflict', () => {
    const { root, a2, squash } = stacked({ reviewFix: true });
    const result = mergeTrunk(root, '--json');

    expect(result.code).toBe(0);

    expect(result.json()).toMatchObject({
      status: 'committed',
      base: {
        commit: a2,
        evidence: 'landed',
        landedAs: { commit: squash, from: 'build/billing-1', subject: 'feat(billing): issue and cancel (#1)' },
      },
      conflicts: { plainMerge: 3, ownDiff: 1, automatic: 1, forYou: 0 },
      automatic: [{ file: OPENAPI, kind: 'derived' }],
      lostLines: { errors: [] },
    });

    expect(parents(root)).toEqual([git(root, 'rev-parse', 'HEAD~1').trim(), squash]);

    expect(lastMessage(root)).toContain(
      `Merge main into build/billing-2\n\nMerge-Base: ${a2}\nTrunk: ${squash}\nLanded: ${squash}`,
    );

    expect(read(root, INVOICE)).toBe(
      invoice('issue(): number { return 1; }', 'cancel() { return 0; }', 'pay() { return 2; }'),
    );

    expect(git(root, 'diff', '--name-only', 'main...HEAD').trim().split('\n')).toEqual([
      DECLARATIONS,
      INVOICE,
      HANDLER,
    ]);

    expect(git(root, 'merge', 'main')).toMatch(/up to date|à jour/i);
  });

  it('takes the base recorded for the worker when its parent branch is gone and its lines are all on the trunk', () => {
    const { root, a2 } = stacked({ reviewFix: false, extra: { 'docs/notes.md': 'Squashed with a note.\n' } });

    git(root, 'branch', '--delete', '--force', 'build/billing-1');
    workerFile(root, { base: 'build/billing-1', baseCommit: a2 });

    const result = mergeTrunk(root, '--json');

    expect(result.code).toBe(0);

    expect(result.json()).toMatchObject({
      status: 'committed',
      base: { commit: a2, evidence: 'recorded' },
      conflicts: { ownDiff: 1, forYou: 0 },
    });
  });

  it('stops before any change when lines of the recorded base are not on the trunk, then merges from the --since a person confirms', () => {
    const { root, a2 } = stacked({ reviewFix: true });
    const head = git(root, 'rev-parse', 'HEAD').trim();

    git(root, 'branch', '--delete', '--force', 'build/billing-1');
    workerFile(root, { base: 'build/billing-1', baseCommit: a2 });

    const stopped = mergeTrunk(root);

    expect(stopped.code).toBe(1);
    expect(stopped.stdout).toContain(`base ${a2.slice(0, 7)}: the base recorded for this worker, not proven`);
    expect(stopped.stdout).toContain(`${INVOICE}:3 (ours)  issue() { return 1; }`);
    expect(stopped.stdout).toContain('npx ddd-ts-kit merge-trunk --since <commit>');
    expect(merging(root)).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD').trim()).toBe(head);

    const confirmed = mergeTrunk(root, '--since', a2, '--json');

    expect(confirmed.json()).toMatchObject({ status: 'committed', base: { commit: a2, evidence: 'option' } });
  });
});

describe('merge-trunk: the base when nothing proves a landing', () => {
  it('falls back to git merge-base without the parent nor a record: more conflicts, never a silent loss', () => {
    const { root } = stacked({ reviewFix: true });

    git(root, 'branch', '--delete', '--force', 'build/billing-1');

    const result = mergeTrunk(root, '--json');

    expect(result.code).toBe(1);

    expect(result.json()).toMatchObject({
      status: 'stopped',
      base: { evidence: 'merge-base', unlanded: [] },
      conflicts: { plainMerge: 3, ownDiff: 3, automatic: 2, forYou: 1 },
      forYou: [{ file: INVOICE, kind: 'source' }],
    });
  });

  it('names a branch sharing commits that was not found on the trunk, with the --since to pass', () => {
    const root = trunkRepository({ [INVOICE]: invoice() });

    onBranch(root, 'build/billing-1');
    const shared = commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }') }, 'A1 issue');

    onBranch(root, 'build/billing-2');
    commitFiles(root, { [HANDLER]: 'export const payHandler = 1;\n' }, 'B1 pay');
    onBranch(root, 'main');
    commitFiles(root, { 'docs/notes.md': 'Unrelated.\n' }, 'docs: notes (#3)');
    onBranch(root, 'build/billing-2');

    const result = mergeTrunk(root, '--dry-run');

    expect(result.stdout).toContain(
      `  build/billing-1 shares commits with this branch and was not found on the trunk: if it landed, pass --since ${shared.slice(0, 7)}`,
    );
  });
});

describe('merge-trunk: the base of a branch reused after its squash', () => {
  it('reuses a branch whose first row landed: no conflict, and the working migration the trunk renamed is not kept twice', () => {
    const root = trunkRepository({
      [OPENAPI]: 'paths:\n  /accounts: {}\n  /zeta: {}\n',
      [INVOICE]: 'export class Invoice {\n  issue() {}\n}\n',
    });

    onBranch(root, 'build/billing');

    commitFiles(
      root,
      {
        'migrations/0001_working-add-payments.sql': 'create table payments();\n',
        [INVOICE]: 'export class Invoice {\n  issue() {}\n  pay() {}\n}\n',
      },
      'row1 part1',
    );

    const landed = commitFiles(
      root,
      { [OPENAPI]: 'paths:\n  /accounts: {}\n  /invoices/pay: {}\n  /zeta: {}\n', [HANDLER]: 'export const h = 1;\n' },
      'row1 part2',
    );

    commitFiles(
      root,
      { [INVOICE]: 'export class Invoice {\n  issue() {}\n  pay() {}\n  refund() {}\n}\n' },
      'row2 refund',
    );

    onBranch(root, 'main');
    commitFiles(root, { [OPENAPI]: 'paths:\n  /accounts: {}\n  /people: {}\n  /zeta: {}\n' }, 'people (#3)');

    const squash = squashInto(root, 'build/billing', {
      message: 'feat(billing): pay (#4)',
      files: {
        'migrations/0001_working-add-payments.sql': null,
        'migrations/0002_add-payments.sql': 'create table payments();\n',
        [OPENAPI]: 'paths:\n  /accounts: {}\n  /invoices/pay: {}\n  /people: {}\n  /zeta: {}\n',
        [INVOICE]: 'export class Invoice {\n  issue() {}\n  pay() {}\n}\n',
      },
    });

    onBranch(root, 'build/billing');

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({
      status: 'committed',
      base: {
        commit: landed,
        evidence: 'landed',
        landedAs: { commit: squash, from: `this branch up to ${landed.slice(0, 7)}` },
      },
      conflicts: { plainMerge: 2, ownDiff: 0 },
    });

    expect(exists(root, 'migrations/0001_working-add-payments.sql')).toBe(false);
    expect(exists(root, 'migrations/0002_add-payments.sql')).toBe(true);
    expect(read(root, INVOICE)).toContain('refund() {}');
  });

  it('never takes for landed a later commit that changed only what the comparison leaves out, unless the trunk holds it', () => {
    const context = 'src/contexts/billing/CONTEXT.md';
    const root = trunkRepository({ [INVOICE]: invoice(), [context]: '# billing\n' });

    onBranch(root, 'build/billing');

    const landed = commitFiles(
      root,
      { [INVOICE]: invoice('issue() { return 1; }'), [context]: '# billing\n\n| Issue | To send an invoice |\n' },
      'row 1',
    );

    const same = commitFiles(root, { [OPENAPI]: openapi(...ISSUE) }, 'chore: regenerate');

    squashInto(root, 'build/billing', { message: 'feat(billing): issue (#1)' });
    onBranch(root, 'build/billing');

    commitFiles(
      root,
      { [context]: '# billing\n\n| Issue | To send an invoice |\n| Pay | To settle an invoice |\n' },
      'row 2: a term',
    );

    const result = mergeTrunk(root, '--json');

    expect(result.json()).toMatchObject({ status: 'committed', base: { commit: same, evidence: 'landed' } });
    expect(read(root, context)).toContain('| Pay | To settle an invoice |');
    expect(landed).not.toBe(same);
  });

  it('finds the landing although another change of the trunk touched the next line before the squash', () => {
    const root = trunkRepository({ 'src/list.ts': ['A', 'B', 'C', 'D', ''].join('\n') });

    onBranch(root, 'build/billing');
    const own = commitFiles(root, { 'src/list.ts': ['A', 'B', 'C', 'C2', 'D', ''].join('\n') }, 'branch adds C2');

    onBranch(root, 'main');
    commitFiles(root, { 'src/list.ts': ['A', 'B', 'B2', 'C', 'D', ''].join('\n') }, 'other pull request adds B2 (#8)');

    squashInto(root, 'build/billing', {
      message: 'feat(billing): C2 (#9)',
      files: { 'src/list.ts': ['A', 'B', 'B2', 'C', 'C2', 'D', ''].join('\n') },
    });

    onBranch(root, 'build/billing');

    expect(mergeTrunk(root, '--dry-run', '--json').json()).toMatchObject({ base: { commit: own, evidence: 'landed' } });
  });
});

describe('merge-trunk: an older git', () => {
  it('with a git older than 2.40, merges with git itself from git merge-base, and refuses a base it cannot compute from', () => {
    const { root, a2 } = stacked({ reviewFix: true });
    const old = { root, trunk: 'main', toLand: false, dryRun: false, gitVersion: 'git version 2.39.2' };

    expect(() => mergeTrunkIn(old)).toThrow(CliError);
    expect(() => mergeTrunkIn(old)).toThrow(/git 2\.39\.2 cannot compute a merge from the landed point/);

    const fork = git(root, 'merge-base', 'HEAD', 'main').trim();
    const report = mergeTrunkIn({ ...old, since: fork });

    expect(report).toMatchObject({
      status: 'stopped',
      base: { commit: fork, evidence: 'option' },
      conflicts: { plainMerge: 3, ownDiff: 3, forYou: 1 },
    });

    expect(merging(root)).toBe(true);
    expect(read(root, '.git/MERGE_MSG')).toContain(`Merge-Base: ${fork}`);
    expect(a2).not.toBe(fork);
  });
});
