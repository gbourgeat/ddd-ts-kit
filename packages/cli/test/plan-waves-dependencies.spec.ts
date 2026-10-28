import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

const CREDIT_FILE = 'src/contexts/billing/domain/aggregates/credit.aggregate.ts';
const CREDIT = 'generate aggregate billing Credit --term "Credit=What billing owes a customer"';
const REFUND = 'generate command billing RefundInvoice --aggregate Credit --permission invoice.refund';

/** A row of the plan: `| <id> | <context> | slice | <id> | `<command>` | <dependsOn> | <context> | todo |`. */
function row(id: string, command: string, dependsOn = '', context = 'billing'): string {
  return `| ${id} | ${context} | slice | ${id} | \`${command}\` | ${dependsOn} | ${context} | todo |\n`;
}

/** The rows written in the slices file of the project, then `plan-waves --json`. */
function planOf(root: string, ...rows: string[]): ReturnType<typeof cli> {
  write(root, 'docs/architecture/slices.md', `${HEADER}${rows.join('')}`);

  return cli(root, 'plan-waves', '--json');
}

/** billing, flat, with its aggregate Invoice and the words of a refund. */
let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core');

  const terms = ['Invoice=What a customer owes', 'Refund=Give back what a customer paid'];

  cli(root, 'generate', 'aggregate', 'billing', 'Invoice', ...terms.flatMap((term) => ['--term', term]));
});

describe('plan-waves, a row that builds on what another row generates', () => {
  it('refuses a row that builds on a file an earlier row of its wave generates, when it does not wait for that row', () => {
    const unordered = planOf(root, row('US5.01', CREDIT), row('US5.02', REFUND));

    expect(unordered.code).toBe(1);

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      {
        kind: 'missing-dependency',
        rows: ['US5.02', 'US5.01'],
        command: REFUND,
        builtOn: CREDIT_FILE,
        message: `#US5.02 \`${REFUND}\` builds on \`${CREDIT_FILE}\`, which #US5.01 generates: add US5.01 to its Depends on, or its worker, on a branch of its own, is refused`,
      },
    ]);

    expect(planOf(root, row('US5.01', CREDIT), row('US5.02', REFUND, 'US5.01')).code).toBe(0);
  });

  it('names the later row that generates what a refused command builds on, when the row does not wait for it', () => {
    const unordered = planOf(root, row('US5.01', REFUND), row('US5.02', CREDIT));

    expect(unordered.code).toBe(1);

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US5.01', 'US5.02'],
        prerequisite: `#US5.02 generates \`${CREDIT_FILE}\`, but #US5.01 does not wait for it: add US5.02 to its Depends on.`,
      }),
    ]);

    expect(planOf(root, row('US5.01', REFUND, 'US5.02'), row('US5.02', CREDIT)).code).toBe(0);
  });

  it('finds the row that generates it by the file, whatever the order of the arguments of its command', () => {
    const leading = 'generate aggregate --term "Credit=What billing owes a customer" billing Credit';
    const unordered = planOf(root, row('US5.01', REFUND), row('US5.02', leading));

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({ kind: 'refused-command', rows: ['US5.01', 'US5.02'] }),
    ]);
  });

  it('says to move the command that generates it when its row waits for the refused row, rather than make a cycle', () => {
    const backwards = planOf(root, row('US5.01', REFUND), row('US5.02', CREDIT, 'US5.01'));

    expect(jsonAt(backwards.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US5.01'],
        prerequisite: `#US5.02 generates \`${CREDIT_FILE}\`, but it waits for #US5.01: move \`${CREDIT}\` to #US5.01, or to a row #US5.01 depends on.`,
      }),
    ]);
  });

  it('says to put first the command of a row that generates what an earlier command of the same row builds on', () => {
    const backwards = planOf(
      root,
      `| US5.01 | billing | slice | Refund | \`${REFUND}\` then \`${CREDIT}\` | | billing | todo |\n`,
    );

    expect(jsonAt(backwards.json(), 'problems')).toEqual([
      expect.objectContaining({
        rows: ['US5.01'],
        prerequisite: `A later command of this row generates \`${CREDIT_FILE}\`: put \`${CREDIT}\` first.`,
      }),
    ]);
  });
});

describe('plan-waves, a row that writes in a context another row creates', () => {
  const shipping =
    'generate context shipping --classification supporting --term "Parcel=A package handed to a carrier"';

  const parcel = 'generate aggregate shipping Parcel';

  it('refuses a row ordered before the row that creates its context, and names that row', () => {
    const unordered = planOf(root, row('US9.01', parcel, '', 'shipping'), row('US9.02', shipping, '', 'shipping'));

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US9.01', 'US9.02'],
        refusal: 'Unknown context "shipping".',
        prerequisite:
          '#US9.02 generates `src/contexts/shipping/CONTEXT.md`, but #US9.01 does not wait for it: add US9.02 to its Depends on.',
      }),
    ]);
  });

  it('refuses a row after the row that creates its context when it does not wait for it, its terms with it, and passes once it does', () => {
    const unordered = planOf(root, row('US9.01', shipping, '', 'shipping'), row('US9.02', parcel, '', 'shipping'));

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({ kind: 'undefined-word', rows: ['US9.02'] }),
      expect.objectContaining({
        kind: 'missing-dependency',
        rows: ['US9.02', 'US9.01'],
        builtOn: 'src/contexts/shipping/CONTEXT.md',
      }),
    ]);

    expect(
      planOf(root, row('US9.01', shipping, '', 'shipping'), row('US9.02', parcel, 'US9.01', 'shipping')).code,
    ).toBe(0);
  });
});
