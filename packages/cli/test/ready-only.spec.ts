import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { committedProject } from './support/committed-project';
import { git } from './support/git';
import { jsonAt } from './support/json-at';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | skeleton | Invoice | | | conductor | done |
| M1.02 | billing | slice | Issue invoice | | M1.01 | billing | todo |
| M1.03 | billing | slice | Cancel invoice | | M1.01, M1.02 | billing | todo |
| M1.04 | billing | slice | Pay invoice | | M1.03 | billing | todo |
`;

let root: string;

beforeAll(() => {
  root = committedProject('shop', '--context', 'billing:core');
  write(root, 'docs/architecture/slices.md', SLICES);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', 'docs: slices');
});

describe('status --ready', () => {
  it('lists the rows that can start on the trunk and counts the others', () => {
    const text = cli(root, 'status', '--ready').stdout;

    expect(text).toContain('#M1.02 billing slice "Issue invoice"');
    expect(text).not.toContain('M1.03 billing');
    expect(text).not.toContain('M1.04 billing');
    expect(text).toContain('2 more not ready to start on the trunk (without --ready to list them)');
  });

  it('keeps the counts and filters the rows of the data', () => {
    const slices = jsonAt(cli(root, 'status', '--ready', '--json').json(), 'slices');

    expect(slices).toMatchObject({ notShown: 2, rows: [{ id: 'M1.02', ready: 'trunk' }] });
    expect(slices).toMatchObject({ byStatus: { todo: ['M1.02', 'M1.03', 'M1.04'] } });
  });

  it('prints every row without the flag', () => {
    const text = cli(root, 'status').stdout;

    expect(text).toContain('M1.04 billing');
    expect(text).not.toContain('without --ready');
  });

  it('says nothing more when every open row can start', () => {
    const rows = cli(root, 'status', '--json').json();

    expect(rows).not.toHaveProperty('slices.notShown');
  });
});

describe('plan-waves --ready', () => {
  it('prints the first wave and one line for the others', () => {
    const { stdout, code } = cli(root, 'plan-waves', '--ready');

    expect(code).toBe(0);
    expect(stdout).toContain('3 rows not done, 3 waves, 3 batches');
    expect(stdout).toContain('Wave 1');
    expect(stdout).not.toContain('Wave 2');
    expect(stdout).toContain('Later: 2 waves, 2 batches, 2 rows');
    expect(stdout).toContain('Merge order: W1.1');
  });

  it('gives the data of the first wave and the count of the others', () => {
    const plan = cli(root, 'plan-waves', '--ready', '--json').json();

    expect(jsonAt(plan, 'waves')).toHaveLength(1);
    expect(jsonAt(plan, 'mergeOrder')).toEqual(['W1.1']);
    expect(jsonAt(plan, 'later')).toEqual({ waves: 2, batches: 2, rows: 2 });
  });

  it('prints every wave without the flag', () => {
    const { stdout } = cli(root, 'plan-waves');

    expect(stdout).toContain('Wave 3');
    expect(stdout).not.toContain('Later:');
  });

  it('is the whole plan, with no line for later, when there is one wave', () => {
    write(
      root,
      'docs/architecture/slices.md',
      SLICES.replace('M1.01, M1.02', 'M1.01').replace('| M1.03 | billing | todo', '| M1.01 | billing | todo'),
    );

    const { stdout } = cli(root, 'plan-waves', '--ready');

    expect(stdout).toContain('Wave 1');
    expect(stdout).not.toContain('Later:');
  });

  it('leaves the problems of rows that cannot be ordered as they are', () => {
    write(
      root,
      'docs/architecture/slices.md',
      SLICES.replace('| Invoice | | | conductor | done |', '| Invoice | | M1.04 | conductor | todo |'),
    );

    const { stdout, code } = cli(root, 'plan-waves', '--ready');

    expect(code).toBe(1);
    expect(stdout).toContain('none');
    expect(stdout).not.toContain('Later:');
  });
});
