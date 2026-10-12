import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { initProject } from './support/init-project.js';

const CONFIG = 'ddd-ts-kit.config.json';

let root: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core', '--package-manager', 'npm');
});

describe('check --commit-size', () => {
  it('measures nothing in a clean tree', () => {
    const clean = cli(root, 'check', '--commit-size');

    expect(clean.code).toBe(0);

    expect(clean.stdout).toBe(
      'Nothing uncommitted to measure (advised at most 20 files and 600 lines a commit, generated files not counted).',
    );

    expect(cli(root, 'check', '--commit-size', '--json').json()).toEqual({
      gitRepository: true,
      staged: false,
      files: 0,
      lines: 0,
      limits: { maxFiles: 20, maxLines: 600 },
      over: false,
      slices: [],
    });
  });

  it('counts tracked changes and untracked files, and names the slices they belong to', () => {
    cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--public',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Issue=To make an invoice final',
    );

    const size = cli(root, 'check', '--commit-size', '--json').json();

    const changed = git(root, 'status', '--porcelain', '--untracked-files=all')
      .trim()
      .split('\n')
      .filter((line) => !line.endsWith('billing.declarations.ts'));

    expect(size).toMatchObject({ files: changed.length, over: false });
    expect(size).toMatchObject({ slices: expect.arrayContaining([{ slice: 'billing: issue-invoice', files: 3 }]) });

    expect(cli(root, 'check', '--commit-size').stdout).toMatch(
      /^\d+ changed files and \d+ changed lines are uncommitted \(advised at most 20 files and 600 lines a commit, generated files not counted\): within the limits\. Slices: billing: issue-invoice \(3 files\)/,
    );
  });

  it('does not count what a command rewrites: generated documents, lockfiles, barrels, the worker scope', () => {
    const before = cli(root, 'check', '--commit-size', '--json').json();

    for (const derived of [
      'package-lock.json',
      'openapi/openapi.yaml',
      'openapi/back-office.json',
      'docs/integration/asyncapi.yaml',
      'src/platform/http/openapi-documents.ts',
      'docs/integration/event-catalog.md',
      '.ddd-ts-kit/worker.json',
      'docs/context-map.md',
      '.dependency-cruiser.cjs',
    ]) {
      write(root, derived, 'rewritten\nby a command\n');
    }

    git(root, 'add', '--force', '.ddd-ts-kit/worker.json');

    expect(cli(root, 'check', '--commit-size', '--json').json()).toEqual(before);
    expect(JSON.stringify(before)).not.toContain('declarations');
  });

  it('counts no line for a file too large to be source', () => {
    const before = cli(root, 'check', '--commit-size', '--json').json();

    fs.writeFileSync(path.join(root, 'dump.sql'), 'x\n'.repeat(600_000));

    expect(cli(root, 'check', '--commit-size', '--json').json()).toMatchObject({
      files: Number(Reflect.get(Object(before), 'files')) + 1,
      lines: Reflect.get(Object(before), 'lines'),
    });

    fs.rmSync(path.join(root, 'dump.sql'));
  });

  it('with --staged measures the index only', () => {
    git(root, 'add', 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts');

    const staged = cli(root, 'check', '--commit-size', '--staged', '--json').json();

    expect(staged).toMatchObject({ staged: true, files: 1, slices: [{ slice: 'billing: issue-invoice', files: 1 }] });
    expect(cli(root, 'check', '--commit-size', '--staged').stdout).toContain('1 changed file and ');
    expect(cli(root, 'check', '--commit-size', '--staged').stdout).toContain(' are staged ');
  });
});

describe('check --commit-size, against the limits and where it runs', () => {
  it('is advisory over the limits of the config, and exits 1 only with --strict', () => {
    limit(root, { maxFiles: 2, maxLines: 10 });

    const over = cli(root, 'check', '--commit-size');

    expect(over.code).toBe(0);

    expect(over.stdout).toContain(
      '(advised at most 2 files and 10 lines a commit, generated files not counted): over the limits. Commit each finished slice on its own, with the files its generator wrote: ',
    );

    expect(cli(root, 'check', '--commit-size', '--strict').code).toBe(1);

    expect(cli(root, 'check', '--commit-size', '--strict', '--json').json()).toMatchObject({
      over: true,
      limits: { maxFiles: 2, maxLines: 10 },
    });
  });

  it('says so outside a git repository, and exits 0 even with --strict', () => {
    const plain = initProject();
    const result = cli(plain, 'check', '--commit-size', '--strict');

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('Not a git repository: the commit size is not measured.');

    expect(cli(plain, 'check', '--commit-size', '--json').json()).toMatchObject({
      gitRepository: false,
      files: 0,
      over: false,
    });
  });

  it('is run by the pre-commit hook of a generated project, on the index, without blocking', () => {
    expect(read(root, 'lefthook.yml')).toContain(
      '    - name: commit size\n      run: npx --no -- ddd-ts-kit check --commit-size --staged\n',
    );
  });
});

function limit(root: string, commit: Record<string, number>): void {
  write(root, CONFIG, `${JSON.stringify({ ...(JSON.parse(read(root, CONFIG)) as object), commit }, null, 2)}\n`);
  git(root, 'add', CONFIG);
  git(root, 'commit', '--quiet', '--message', 'chore: size the commits');
}
