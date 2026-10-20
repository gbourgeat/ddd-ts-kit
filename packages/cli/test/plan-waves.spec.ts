import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

/** Two stories building in billing at once, and a shipping row waiting for the second wave of billing. */
const TWO_STORIES = `# Slices

## US1 Issue and settle invoices

${HEADER}| US1.01 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` then \`generate repository billing Invoice\` | | conductor | done |
| US1.02 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | US1.01 | billing | todo |
| US1.03 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --permission invoice.cancel\` | US1.01 | billing | todo |
| US1.04 | billing | slice | Pay invoice | \`generate command billing PayInvoice --aggregate Invoice --permission invoice.pay\` | US1.02 | billing | todo |

## US2 Know the customers

${HEADER}| US2.01 | billing | skeleton | Customer | \`generate aggregate billing Customer\` then \`generate repository billing Customer\` | | conductor | todo |
| US2.02 | billing | slice | Register customer | \`generate command billing RegisterCustomer --aggregate Customer --permission customer.register\` | US2.01 | billing | todo |
| US2.03 | billing | slice | Overdue invoices | \`generate query billing SearchOverdueInvoices --permission invoice.read --search\` | US1.02 | billing | todo |
| US2.04 | billing | slice | Credit invoice | \`generate command billing CreditInvoice --aggregate Invoice --permission invoice.credit\` | | billing | in progress |
| US2.05 | shipping | slice | Ship a paid invoice | \`generate integration-handler shipping billing billing.invoice.paid\` | US1.04 | shipping | todo |
`;

let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');
  write(root, 'docs/architecture/slices.md', TWO_STORIES);
});

describe('plan-waves, two stories building in one context', () => {
  it('puts in wave 1 the rows whose dependencies are done, and each later row one wave past what it waits for', () => {
    const plan = cli(root, 'plan-waves', '--json');

    expect(plan.code).toBe(0);

    const rowsOf = (wave: unknown): unknown[] =>
      listAt(wave, 'batches').flatMap((batch) => listAt(batch, 'rows').map((row) => jsonAt(row, 'id')));

    expect(listAt(plan.json(), 'waves').map((wave) => [jsonAt(wave, 'wave'), rowsOf(wave)])).toEqual([
      [1, ['US1.02', 'US1.03', 'US2.01', 'US2.04']],
      [2, ['US1.04', 'US2.02', 'US2.03']],
      [3, ['US2.05']],
    ]);
  });

  it('batches two rows of one owner on one aggregate, and marks the batches of one wave that share an aggregate', () => {
    const [first] = listAt(cli(root, 'plan-waves', '--json').json(), 'waves');

    expect(jsonAt(first, 'batches')).toEqual([
      {
        id: 'W1.1',
        owner: 'billing',
        context: 'billing',
        rows: [
          {
            id: 'US1.02',
            kind: 'slice',
            slice: 'Issue invoice',
            status: 'todo',
            story: 'US1',
            waitingFor: [],
            waitingForRows: [],
          },
          {
            id: 'US1.03',
            kind: 'slice',
            slice: 'Cancel invoice',
            status: 'todo',
            story: 'US1',
            waitingFor: [],
            waitingForRows: [],
          },
        ],
        aggregates: ['Invoice'],
        brief: `npx ddd-ts-kit worker-scope billing --base origin/main --rows US1.02,US1.03 --worktree .worktrees/billing-w1.1 --branch build/billing-w1.1`,
        sameFiles: ['W1.3'],
        unknownOverlap: [],
      },
      {
        id: 'W1.2',
        owner: 'conductor',
        context: 'billing',
        rows: [
          {
            id: 'US2.01',
            kind: 'skeleton',
            slice: 'Customer',
            status: 'todo',
            story: 'US2',
            waitingFor: [],
            waitingForRows: [],
          },
        ],
        aggregates: ['Customer'],
        brief: null,
        sameFiles: [],
        unknownOverlap: [],
      },
      expect.objectContaining({
        id: 'W1.3',
        rows: [expect.objectContaining({ id: 'US2.04', status: 'in progress' })],
        brief: `npx ddd-ts-kit worker-scope billing --base origin/main --rows US2.04 --worktree .worktrees/billing-w1.3 --branch build/billing-w1.3`,
        sameFiles: ['W1.1'],
      }),
    ]);
  });

  it('says so when a batch names no aggregate, rather than guessing, and orders the merges by wave then by what waits', () => {
    const plan = cli(root, 'plan-waves', '--json').json();
    const [, second] = listAt(plan, 'waves');

    expect(jsonAt(second, 'batches')).toEqual([
      expect.objectContaining({ id: 'W2.1', aggregates: ['Invoice'], unknownOverlap: ['W2.3'] }),
      expect.objectContaining({ id: 'W2.2', aggregates: ['Customer'], unknownOverlap: ['W2.3'] }),
      expect.objectContaining({
        id: 'W2.3',
        rows: [expect.objectContaining({ id: 'US2.03', waitingFor: ['US1.02'] })],
        aggregates: [],
        sameFiles: [],
        unknownOverlap: ['W2.1', 'W2.2'],
      }),
    ]);

    expect(jsonAt(plan, 'mergeOrder')).toEqual(['W1.1', 'W1.2', 'W1.3', 'W2.1', 'W2.2', 'W2.3', 'W3.1']);
  });
});

describe('plan-waves for a reader', () => {
  it('prints each wave, its batches with the command that briefs them, then the merge order and what precedes each merge', () => {
    const text = cli(root, 'plan-waves').stdout;

    expect(text).toContain('Waves (docs/architecture/slices.md): 8 rows not done, 3 waves, 7 batches\nWave 1\n');

    expect(text).toContain(
      `  W1.1 billing (aggregate Invoice)\n    #US1.02 slice "Issue invoice"\n    #US1.03 slice "Cancel invoice"\n    npx ddd-ts-kit worker-scope billing --base origin/main --rows US1.02,US1.03 --worktree .worktrees/billing-w1.1 --branch build/billing-w1.1\n    likely to touch the same files as W1.3\n`,
    );

    expect(text).toContain(
      '  W1.2 conductor, billing (aggregate Customer)\n    #US2.01 skeleton "Customer"\n    on the trunk, by the conductor\n',
    );

    expect(text).toContain('    #US2.04 slice "Credit invoice" (in progress)\n');
    expect(text).toContain('    #US1.04 slice "Pay invoice", after #US1.02 (todo)\n');

    expect(text).toContain(
      '  W2.3 billing (aggregate unknown)\n    #US2.03 slice "Overdue invoices", after #US1.02 (todo, billing, story US1)\n',
    );

    expect(text).toContain('    unknown whether it touches the files of W2.1, W2.2: no aggregate named');

    expect(text).toContain(
      [
        'Rows another story waits for, not done',
        '  #US1.02 billing slice "Issue invoice" (story US1, owner billing, todo): in W1.1, waited for by #US2.03',
        '  #US1.04 billing slice "Pay invoice" (story US1, owner billing, todo): in W2.1, waited for by #US2.05',
        'Merge order: W1.1',
      ].join('\n'),
    );

    expect(text).toContain(
      'Merge order: W1.1, W1.2, W1.3, W2.1, W2.2, W2.3, W3.1\nBefore each merge: `npx ddd-ts-kit merge-trunk --to-land --cwd <worktree>`, then the squash merge',
    );
  });
});

describe('plan-waves, the rows one story waits for in another', () => {
  it('gives each row it waits for with its context, story and status, and lists apart the rows another story waits for', () => {
    const plan = cli(root, 'plan-waves', '--json').json();

    const rows = listAt(plan, 'waves').flatMap((wave) =>
      listAt(wave, 'batches').flatMap((batch) => listAt(batch, 'rows')),
    );

    expect(rows.find((row) => jsonAt(row, 'id') === 'US2.05')).toMatchObject({
      story: 'US2',
      waitingFor: ['US1.04'],
      waitingForRows: [{ id: 'US1.04', context: 'billing', story: 'US1', status: 'todo' }],
    });

    expect(jsonAt(plan, 'otherStories')).toEqual([
      {
        id: 'US1.02',
        context: 'billing',
        story: 'US1',
        kind: 'slice',
        slice: 'Issue invoice',
        owner: 'billing',
        status: 'todo',
        batch: 'W1.1',
        waitedForBy: ['US2.03'],
      },
      expect.objectContaining({ id: 'US1.04', story: 'US1', status: 'todo', batch: 'W2.1', waitedForBy: ['US2.05'] }),
    ]);
  });
});

describe('plan-waves <context>', () => {
  it('plans one context, counting the waves of the rows of other contexts it waits for', () => {
    const plan = cli(root, 'plan-waves', 'shipping', '--json').json();

    expect(plan).toMatchObject({
      context: 'shipping',
      problems: [],
      waves: [
        {
          wave: 3,
          batches: [
            {
              id: 'W3.1',
              rows: [expect.objectContaining({ id: 'US2.05', waitingFor: ['US1.04'] })],
              brief: 'npx ddd-ts-kit worker-scope shipping --base origin/main --rows US2.05',
            },
          ],
        },
      ],
      mergeOrder: ['W3.1'],
      otherStories: [expect.objectContaining({ id: 'US1.04', batch: null, waitedForBy: ['US2.05'] })],
    });

    const text = cli(root, 'plan-waves', 'shipping').stdout;

    expect(text).toContain('    #US2.05 slice "Ship a paid invoice", after #US1.04 (todo, billing, story US1)\n');

    expect(text).toContain(
      'Rows another story waits for, not done\n  #US1.04 billing slice "Pay invoice" (story US1, owner billing, todo): not shown here (npx ddd-ts-kit plan-waves billing), waited for by #US2.05\n',
    );

    expect(cli(root, 'plan-waves', 'ordering').stderr).toContain(
      'No row of docs/architecture/slices.md is in the context "ordering"',
    );
  });
});

describe('plan-waves, a plan that cannot be ordered', () => {
  it('refuses to order a plan with a cycle, an unknown dependency or a row without owner, and gives no wave', () => {
    write(
      root,
      'docs/architecture/slices.md',
      `${HEADER}| US3.01 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --public\` | US3.02 | billing | todo |\n| US3.02 | billing | slice | Cancel invoice | \`generate command billing CancelInvoice --aggregate Invoice --public\` | US3.01 | billing | todo |\n| US3.03 | billing | slice | Pay invoice | \`generate command billing PayInvoice --aggregate Invoice --public\` | US9.01 | | todo |\n`,
    );

    const refused = cli(root, 'plan-waves', '--json');

    expect(refused.code).toBe(1);

    expect(refused.json()).toMatchObject({
      problems: [
        { kind: 'unknown-dependency', rows: ['US3.03', 'US9.01'] },
        { kind: 'no-owner', rows: ['US3.03'] },
        { kind: 'cycle', rows: ['US3.01', 'US3.02', 'US3.01'] },
      ],
      waves: [],
      mergeOrder: [],
      otherStories: [],
    });

    expect(cli(root, 'plan-waves').stdout.split('\n')).toEqual([
      'Waves (docs/architecture/slices.md): none, the plan cannot be ordered until these rows are fixed',
      '  #US3.03 depends on #US9.01, which no row carries',
      '  #US3.03 has no owner: conductor, the name of a context, or a person',
      '  cycle: #US3.01 depends on #US3.02, which depends on #US3.01: none of them can start',
    ]);
  });
});

/** The array under a path of keys; empty when it holds none. */
function listAt(value: unknown, ...keys: readonly string[]): unknown[] {
  const found = jsonAt(value, ...keys);

  return Array.isArray(found) ? found : [];
}
