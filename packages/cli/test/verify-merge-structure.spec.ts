import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers';
import { git } from './support/git';
import { BOTH_KEPT, INVOICE, PAY_AND_CANCEL, spec } from './support/invoicing-merge';
import { jsonAt } from './support/json-at';
import { commit, mergeRepository, mergeWith, startMerge } from './support/merge-repository';

const PAY_SPEC = 'src/contexts/billing/pay-invoice.spec.ts';

function kinds(answer: unknown, key: 'errors' | 'accepted' | 'repaired' = 'errors'): string[] {
  const findings = jsonAt(answer, 'merges', '0', key);

  return Array.isArray(findings) ? findings.map((finding) => String(jsonAt(finding, 'kind'))) : [];
}

const lines = (...body: readonly string[]): string => ['export class Invoice {', ...body, '}', ''].join('\n');

describe('verify-merge, the base of a merge', () => {
  it('judges a merge on the base its Merge-Base trailer records: a line the trunk rewrote after the squash of the first branch is no loss', () => {
    const root = tempDir('stacked');

    git(root, 'init', '--quiet', '--initial-branch', 'main');
    commit(root, { [INVOICE]: lines('  constructor() {}') }, 'chore: base');
    git(root, 'switch', '--quiet', '--create', 'build/billing-1');
    commit(root, { [INVOICE]: lines('  constructor() {}', '  issue() { return 1; }') }, 'feat(billing): issue');
    const firstBranch = git(root, 'rev-parse', 'HEAD').trim();

    git(root, 'switch', '--quiet', '--create', 'build/billing-2');

    commit(
      root,
      { [INVOICE]: lines('  constructor() {}', '  issue() { return 1; }', '  pay() { return 2; }') },
      'feat(billing): pay',
    );

    git(root, 'switch', '--quiet', 'main');

    commit(
      root,
      { [INVOICE]: lines('  constructor() {}', '  issue(): number { return 1; }') },
      'feat(billing): issue (#1)',
    );

    git(root, 'switch', '--quiet', 'build/billing-2');

    mergeWith(root, {
      [INVOICE]: lines('  constructor() {}', '  issue(): number { return 1; }', '  pay() { return 2; }'),
    });

    const fromGit = cli(root, 'verify-merge', 'HEAD', '--json').json();
    const named = cli(root, 'verify-merge', 'HEAD', '--base', firstBranch, '--json').json();

    git(
      root,
      'commit',
      '--quiet',
      '--amend',
      '--message',
      `Merge main into build/billing-2\n\nMerge-Base: ${firstBranch}`,
    );

    const recorded = cli(root, 'verify-merge', 'HEAD', '--json').json();

    expect(kinds(fromGit)).toEqual(['lost-line']);
    expect(jsonAt(fromGit, 'merges', '0', 'baseFrom')).toBe('merge-base');
    expect(kinds(named)).toEqual([]);
    expect(jsonAt(named, 'merges', '0', 'baseFrom')).toBe('option');
    expect(kinds(recorded)).toEqual([]);
    expect(jsonAt(recorded, 'merges', '0', 'base')).toBe(firstBranch);
    expect(cli(root, 'verify-merge', 'HEAD').stdout).toMatch(/: ok$/);
  });

  it('checks a squash commit against the head of the branch it took in, named with --theirs', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    git(root, 'switch', '--quiet', 'main');
    git(root, 'merge', '--quiet', '--squash', '-X', 'ours', 'build/billing');
    git(root, 'commit', '--quiet', '--allow-empty', '--message', 'feat(billing): pay an invoice (#4)');

    const squash = cli(root, 'verify-merge', 'HEAD', '--theirs', 'build/billing', '--json').json();
    const unnamed = cli(root, 'verify-merge', 'HEAD');

    expect(jsonAt(squash, 'ok')).toBe(false);
    expect(kinds(squash)).toEqual(expect.arrayContaining(['lost-line', 'row-not-done', 'test-lost']));
    expect(unnamed.code).toBe(2);
    expect(unnamed.stderr).toContain('is not a merge commit: it has one parent.');
    expect(unnamed.stderr).toContain('--theirs <branch head>');
  });
});

describe('verify-merge, what a merge left or deleted', () => {
  it('reports the conflict markers committed with a merge', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    startMerge(root, {});
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--no-edit');

    const result = cli(root, 'verify-merge', 'HEAD');

    expect(result.code).toBe(1);
    expect(kinds(cli(root, 'verify-merge', 'HEAD', '--json').json())).toContain('conflict-marker');
    expect(result.stdout).toContain('conflict markers:\n');
    expect(result.stdout).toContain(`    ${INVOICE}:8 (result)  <<<<<<< HEAD`);
  });

  it('reports a spec file of the branch the merge deleted, never one a side deleted', () => {
    const root = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}'), 'src/contexts/billing/draft.spec.ts': spec() },
      ours: { [PAY_SPEC]: spec(['pays an issued invoice', 'pay']) },
      theirs: { [INVOICE]: lines('  issue() {}', '  cancel() {}'), 'src/contexts/billing/draft.spec.ts': null },
    });

    mergeWith(root, { [PAY_SPEC]: null });

    const answer = cli(root, 'verify-merge', 'HEAD', '--json').json();

    const files = JSON.stringify(jsonAt(answer, 'merges', '0', 'errors'));

    expect(kinds(answer)).toEqual(['test-lost', 'test-lost', 'spec-deleted']);
    expect(files).not.toContain('draft.spec.ts');
    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(`spec files deleted:\n    ${PAY_SPEC} (ours)`);
  });

  it('knows a migration by its description: renumbered or no longer working it is kept, gone it is lost', () => {
    const histories = {
      base: { 'migrations/0001_create-invoices.sql': 'create table invoices ();\n' },
      ours: { 'migrations/0002_working-add-payments.sql': 'create table payments ();\n' },
      theirs: { 'migrations/0002_add-refunds.sql': 'create table refunds ();\n' },
    };

    const renamed = mergeRepository(histories);
    const dropped = mergeRepository(histories);

    mergeWith(renamed, {
      'migrations/0002_working-add-payments.sql': null,
      'migrations/0003_add-payments.sql': 'create table payments ();\n',
    });

    mergeWith(dropped, { 'migrations/0002_working-add-payments.sql': null });

    expect(kinds(cli(renamed, 'verify-merge', 'HEAD', '--json').json())).toEqual([]);
    expect(kinds(cli(dropped, 'verify-merge', 'HEAD', '--json').json())).toEqual(['migration-lost']);

    expect(cli(dropped, 'verify-merge', 'HEAD').stdout).toContain(
      'migrations/0002_working-add-payments.sql (ours)  migration "addpayments" missing from the result',
    );
  });
});

describe('verify-merge, decided and repaired losses', () => {
  it('lists the losses a Lost-Accepted trailer names, by file or by file:line, without failing on them', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    const message =
      'Merge main into build/billing\n\nLost-Accepted: src/contexts/billing/invoice.ts, src/contexts/billing/routes.ts:4';

    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', message);

    const partly = cli(root, 'verify-merge', 'HEAD', '--json').json();

    git(
      root,
      'commit',
      '--quiet',
      '--amend',
      '--message',
      `${message},\n  src/contexts/billing/invoice.spec.ts, docs/architecture/slices.md:4`,
    );

    const whole = cli(root, 'verify-merge', 'HEAD');

    expect(kinds(partly, 'accepted')).toHaveLength(4);
    expect(kinds(partly)).toEqual(['lost-line', 'lost-line', 'row-not-done', 'test-lost']);
    expect(whole.code).toBe(0);
    expect(whole.stdout).toContain('accepted (Lost-Accepted):');
  });

  it('reads the trailers of a merge in progress from its message', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    startMerge(root, {}, '-X', 'theirs');
    fs.appendFileSync(path.join(root, '.git', 'MERGE_MSG'), '\nLost-Accepted: src/contexts/billing/invoice.ts\n');

    const answer = cli(root, 'verify-merge', '--json').json();
    const text = cli(root, 'verify-merge').stdout;

    expect(kinds(answer, 'accepted')).toEqual(['lost-line', 'lost-line', 'lost-line']);
    expect(kinds(answer)).toHaveLength(5);

    expect(text).toMatch(
      /^merge in progress \(HEAD <- [0-9a-f]{7}\) "Merge branch 'main' into build\/billing": 5 error\(s\)/,
    );

    expect(text).toContain('`git show MERGE_HEAD:<file>` for theirs');
  });

  it("lists every merge since the worker's base, and a loss a later commit restored as repaired", () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', base: 'main' }));
    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', 'Merge main into build/billing');

    const lost = cli(root, 'verify-merge');

    commit(root, BOTH_KEPT, 'fix(billing): restore paying an invoice');

    const repaired = cli(root, 'verify-merge', '--json');

    expect(lost.code).toBe(1);
    expect(repaired.code).toBe(0);
    expect(jsonAt(repaired.json(), 'since')).toBe('main');
    expect(kinds(repaired.json(), 'repaired')).toHaveLength(8);
    expect(cli(root, 'verify-merge').stdout).toContain('repaired since (HEAD has them again):');
  });
});

describe('verify-merge, refusals', () => {
  it('names the fix for what it cannot check', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const outside = tempDir('no-repository');

    const refusals = [
      [cli(outside, 'verify-merge'), 'is not inside a git repository'],
      [cli(root, 'verify-merge', 'nothing-here'), 'nothing-here is not a commit of this repository'],
      [cli(root, 'verify-merge', '--theirs', 'main'), '--theirs names the branch a squash commit took in'],
      [cli(root, 'verify-merge', '--base', 'main'), '--base is the base of one merge'],
      [cli(root, 'verify-merge', '--since', 'nothing-here'), 'Fetch it first, or pass the trunk'],
      [
        cli(root, 'verify-merge', 'HEAD', '--theirs', 'main', '--base', 'nothing-here'),
        'nothing-here is not a commit of this repository',
      ],
      [
        cli(root, 'verify-merge', 'main', '--theirs', 'nothing-here'),
        'nothing-here is not a commit of this repository',
      ],
    ] as const;

    for (const [result, message] of refusals) {
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(message);
    }
  });

  it('refuses a ref that starts with a dash as a commit it does not name, before git reads it as an option', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const output = path.join(tempDir('verify-merge-output'), 'log.txt');

    const dashed = `--output=${output}`;

    for (const refused of [
      cli(root, 'verify-merge', `--since=${dashed}`),
      cli(root, 'verify-merge', 'main', `--theirs=${dashed}`),
      cli(root, 'verify-merge', 'HEAD', '--theirs', 'main', `--base=${dashed}`),
    ]) {
      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`--output=${output} is not a commit of this repository.`);
    }

    expect(fs.existsSync(output)).toBe(false);
  });
});
