import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';

const PLAN =
  '# Architecture plan\n\nNext: 6 plan-slices - cut the first slices of billing\n\nThe `Next:` line above is read by tools.\n';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` then \`generate repository billing Invoice\` | | conductor | done |
| 2 | billing | contract | Invoice issued | \`generate integration-event billing Invoice Issued\` | 1 | conductor | in progress |
| 3 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\`; \`generate route billing IssueInvoice --method POST --path /invoices\` | 1, 2 | billing | todo |
| 4 | shipping | slice | Ship an issued invoice | \`generate context shipping --classification <core\\|supporting\\|generic>\` | 2 | shipping | Todo |

Slice 3 refuses an invoice without lines.
`;

describe('status', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment');
  });

  it('says what is missing when the project has neither a plan nor slices, and still counts what is left', () => {
    const status = cli(root, 'status');

    expect(status.code).toBe(0);
    expect(status.stdout).toContain('Next: no docs/architecture/plan.md');
    expect(status.stdout).toContain('The recommended path starts with step 1, discover the domain, before any code');
    expect(status.stdout).toContain('Slices: no docs/architecture/slices.md');
    expect(cli(root, 'status', '--json').json()).toMatchObject({ next: null, slices: null });
  });

  it('reads the Next line of the plan', () => {
    write(root, 'docs/architecture/plan.md', PLAN);

    expect(cli(root, 'status').stdout).toContain('Next: 6 plan-slices - cut the first slices of billing\n');

    expect(jsonAt(cli(root, 'status', '--json').json(), 'next')).toBe(
      '6 plan-slices - cut the first slices of billing',
    );
  });

  it('groups the rows of the slices table by status and by owner', () => {
    write(root, 'docs/architecture/slices.md', SLICES);

    const slices = jsonAt(cli(root, 'status', '--json').json(), 'slices');

    expect(slices).toMatchObject({
      file: 'docs/architecture/slices.md',
      byStatus: { done: ['1'], 'in progress': ['2'], todo: ['3', '4'] },
      byOwner: {
        billing: { todo: ['3'] },
        conductor: { done: ['1'], 'in progress': ['2'] },
        shipping: { todo: ['4'] },
      },
    });

    expect(jsonAt(slices, 'rows')).toContainEqual({
      id: '4',
      context: 'shipping',
      kind: 'slice',
      slice: 'Ship an issued invoice',
      startWith: '`generate context shipping --classification <core|supporting|generic>`',
      dependsOn: ['2'],
      owner: 'shipping',
      status: 'todo',
    });
  });

  it('prints the slices that are not done, then the count of each owner', () => {
    const status = cli(root, 'status').stdout;

    expect(status).toContain('Slices (docs/architecture/slices.md): 4, 1 in progress, 2 todo, 1 done');
    expect(status).toContain('  in progress\n    #2 billing contract "Invoice issued" (owner conductor, depends on 1)');
    expect(status).toContain('    #3 billing slice "Issue invoice" (owner billing, depends on 1, 2)');

    expect(status).toContain(
      '  by owner\n    billing: 1 todo\n    conductor: 1 in progress, 1 done\n    shipping: 1 todo',
    );

    expect(status).not.toContain('#1 billing skeleton');
  });

  it('reads every slices table of the file, in order, and says which row numbers are used twice', () => {
    write(
      root,
      'docs/architecture/slices.md',
      `${SLICES}\n## Milestone 2\n\n| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n| 5 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --permission invoice.cancel\` | 3 | billing | todo |\n| 3 | shipping | slice | Track a shipment | \`generate query shipping TrackShipment --permission shipment.track\` | 4 | shipping | todo |\n`,
    );

    const slices = jsonAt(cli(root, 'status', '--json').json(), 'slices');

    expect(slices).toMatchObject({
      byStatus: { done: ['1'], 'in progress': ['2'], todo: ['3', '4', '5', '3'] },
      byOwner: { billing: { todo: ['3', '5'] }, shipping: { todo: ['4', '3'] } },
      duplicates: ['3'],
    });

    expect(cli(root, 'status').stdout).toContain(
      'Slices (docs/architecture/slices.md): 6, 1 in progress, 4 todo, 1 done\n  row numbers used more than once: 3 (give each row its own number)',
    );
  });

  it('says which row numbers carry no code of their story or milestone', () => {
    write(
      root,
      'docs/architecture/slices.md',
      `| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n| US5.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | | billing | todo |\n| 7 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --permission invoice.cancel\` | US5.01 | billing | todo |\n`,
    );

    expect(jsonAt(cli(root, 'status', '--json').json(), 'slices')).toMatchObject({ unscoped: ['7'], duplicates: [] });

    expect(cli(root, 'status').stdout).toContain(
      '  row numbers without the code of their story or milestone: 7 (number them `US5.03`, `M2.07`',
    );
  });

  it('reads a slices file without the table as a project without slices', () => {
    write(root, 'docs/architecture/slices.md', '# Slices\n\nNothing cut yet.\n');

    expect(jsonAt(cli(root, 'status', '--json').json(), 'slices')).toBeNull();
  });
});

describe('status, what is left in each context', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment');
  });

  it('counts the TODO(domain), the it.todo and the TODO(review) left in each context', () => {
    write(
      root,
      AGGREGATE,
      `${read(root, AGGREGATE)}\n// TODO(review): name the total after its term in the glossary.\n`,
    );

    const remaining = jsonAt(cli(root, 'status', '--json').json(), 'remaining');
    const listed = jsonAt(cli(root, 'todo', 'billing', '--json').json(), 'remaining');

    const count = (kind: string): number =>
      Array.isArray(listed) ? listed.filter((left) => jsonAt(left, 'kind') === kind).length : -1;

    expect(remaining).toContainEqual({
      context: 'billing',
      domain: count('domain'),
      platform: count('platform'),
      test: count('test'),
      review: 1,
    });

    expect(count('domain')).toBeGreaterThan(0);
    expect(count('test')).toBeGreaterThan(0);
    expect(count('review')).toBe(1);

    expect(cli(root, 'status').stdout).toMatch(
      / {2}billing: \d+ TODO\(domain\), \d+ TODO\(platform\), \d+ it\.todo, 1 TODO\(review\)/,
    );
  });
});
