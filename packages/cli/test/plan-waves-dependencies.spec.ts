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

describe('plan-waves, a refused command run again', () => {
  const pay =
    'generate command billing PayInvoice --aggregate Invoice --permission invoice.pay --term "Pay=Settle an invoice"';

  const route = 'generate route billing PayInvoice --method POST --path /invoices/:invoiceId/payment';

  it('runs it again without writing, so that a command another refused one would make pass is not taken as passing', () => {
    const refused = planOf(
      root,
      row('US3.01', route),
      row('US3.02', 'generate e2e billing PayInvoice'),
      row('US3.03', pay),
    );

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        rows: ['US3.01', 'US3.03'],
        prerequisite: expect.stringContaining(
          '#US3.03 generates `src/contexts/billing/application/commands/pay-invoice/',
        ),
      }),
      expect.objectContaining({
        rows: ['US3.02'],
        prerequisite:
          'No row of the plan generates it as the rows are written: add the command the fix names to this row or to a row it depends on, or fix the refused row that would generate it.',
      }),
    ]);
  });

  it('names the context row for each of two refused rows written before it', () => {
    const shipping =
      'generate context shipping --classification supporting --term "Parcel=A package handed to a carrier"';

    const refused = planOf(
      root,
      row('US9.01', 'generate aggregate shipping Parcel', '', 'shipping'),
      row('US9.02', 'generate aggregate shipping Crate --term "Crate=A box of parcels"', '', 'shipping'),
      row('US9.03', shipping, '', 'shipping'),
    );

    expect(jsonAt(refused.json(), 'problems')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'refused-command', rows: ['US9.01', 'US9.03'] }),
        expect.objectContaining({ kind: 'refused-command', rows: ['US9.02', 'US9.03'] }),
      ]),
    );
  });
});

describe('plan-waves, an end-to-end spec on the route of another row', () => {
  const payRow = (id: string): string =>
    `| ${id} | billing | slice | Pay invoice | \`generate command billing PayInvoice --aggregate Invoice --permission invoice.pay --term "Pay=Settle an invoice"\` then \`generate route billing PayInvoice --method POST --path /invoices/:invoiceId/payment\` | | billing | todo |\n`;

  const controller = 'src/contexts/billing/presentation/http/invoices/pay-invoice/pay-invoice.controller.ts';

  it('refuses an end-to-end spec written after the row of its route when it does not wait for it', () => {
    const unordered = planOf(root, payRow('US4.01'), row('US4.02', 'generate e2e billing PayInvoice'));

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({ kind: 'missing-dependency', rows: ['US4.02', 'US4.01'], builtOn: controller }),
    ]);

    expect(planOf(root, payRow('US4.01'), row('US4.02', 'generate e2e billing PayInvoice', 'US4.01')).code).toBe(0);
  });

  it('names the row of its route for an end-to-end spec written before it', () => {
    const unordered = planOf(root, row('US4.02', 'generate e2e billing PayInvoice'), payRow('US4.01'));

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US4.02', 'US4.01'],
        prerequisite: `#US4.01 generates \`${controller}\`, but #US4.02 does not wait for it: add US4.01 to its Depends on.`,
      }),
    ]);
  });
});

describe('plan-waves, a row in progress that builds on another row', () => {
  it('does not hold against the plan a row in progress that does not wait for the row it built on', () => {
    const started = `| US5.02 | billing | slice | US5.02 | \`${REFUND}\` | | billing | in progress |\n`;

    expect(planOf(root, row('US5.01', CREDIT), started).code).toBe(0);
  });
});
