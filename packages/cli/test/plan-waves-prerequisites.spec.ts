import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

/** A row of the plan: `| <id> | <context> | slice | <id> | `<command>` | <dependsOn> | <context> | todo |`. */
function row(id: string, command: string, dependsOn = '', context = 'billing'): string {
  return `| ${id} | ${context} | slice | ${id} | \`${command}\` | ${dependsOn} | ${context} | todo |\n`;
}

/** The rows written in the slices file of the project, then `plan-waves --json`. */
function planOf(root: string, ...rows: string[]): ReturnType<typeof cli> {
  write(root, 'docs/architecture/slices.md', `${HEADER}${rows.join('')}`);

  return cli(root, 'plan-waves', '--json');
}

/** billing, flat, with its aggregate Invoice. */
let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core');

  cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=What a customer owes');
});

describe('plan-waves, a refused command that builds on two files', () => {
  const route = 'generate route billing PayInvoice --method POST --path /invoices/:invoiceId/payment --group Invoices';

  const pay =
    'generate command billing PayInvoice --aggregate Invoice --permission invoice.pay --term "Pay=Settle an invoice"';

  const group = 'generate route-group billing Invoices --prefix /invoices';

  it('names each later row that generates one, in one pass', () => {
    const refused = planOf(root, row('US3.01', route), row('US3.02', pay), row('US3.03', group));

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US3.01', 'US3.02', 'US3.03'],
        prerequisite: expect.stringMatching(
          /^#US3\.02 generates `[^`]+pay-invoice\.command\.ts`, but #US3\.01 does not wait for it: add US3\.02 to its Depends on\.\n#US3\.03 generates `[^`]+invoices[^`]*\.ts`, but #US3\.01 does not wait for it: add US3\.03 to its Depends on\.$/,
        ),
        nextRefusal: null,
      }),
    ]);

    expect(planOf(root, row('US3.01', route, 'US3.02, US3.03'), row('US3.02', pay), row('US3.03', group)).code).toBe(0);
  });

  it('says the second file no row generates, met once the first is found, with the row of the first', () => {
    const refused = planOf(root, row('US3.01', route), row('US3.02', pay));

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        rows: ['US3.01', 'US3.02'],
        prerequisite: expect.stringContaining('add US3.02 to its Depends on.'),
        nextRefusal: {
          refusal: expect.stringContaining('The route group InvoicesRoutes does not exist'),
          fix: expect.stringContaining('generate route-group'),
          prerequisite:
            'No row of the plan generates it as the rows are written: add the command the fix names to this row or to a row it depends on, or fix the refused row that would generate it.',
        },
      }),
    ]);
  });
});

describe('plan-waves of one context, a row that builds on what a row of another context generates', () => {
  /** billing, with its aggregate Invoice; analytics, downstream of billing. */
  let upstream: string;

  beforeAll(() => {
    upstream = initProject('--context', 'billing:core');

    cli(upstream, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=What a customer owes');

    cli(
      upstream,
      'generate',
      'context',
      'analytics',
      '--classification',
      'generic',
      '--upstream',
      'billing',
      '--term',
      'Invoice=What a customer owes, as billing announces it',
      '--term',
      'Issue=Send an invoice to its customer',
    );
  });

  const projection = 'generate projection analytics IssuedInvoices billing.invoice.issued';
  const declared = 'generate integration-event billing Invoice Issued --term "Issue=Send an invoice to its customer"';

  it('names the row of the other context that generates it, which a row it does not wait for the plan of the context replays too', () => {
    write(
      upstream,
      'docs/architecture/slices.md',
      `${HEADER}${row('US7.01', projection, '', 'analytics')}${row('US7.02', declared)}`,
    );

    const refused = cli(upstream, 'plan-waves', 'analytics', '--json');

    expect(refused.code).toBe(1);

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US7.01', 'US7.02'],
        prerequisite: expect.stringMatching(
          /^#US7\.02 generates `src\/contexts\/billing\/published-language\/[^`]+`, but #US7\.01 does not wait for it: add US7\.02 to its Depends on\.$/,
        ),
      }),
    ]);

    write(
      upstream,
      'docs/architecture/slices.md',
      `${HEADER}${row('US7.01', projection, 'US7.02', 'analytics')}${row('US7.02', declared)}`,
    );

    expect(cli(upstream, 'plan-waves', 'analytics').code).toBe(0);
  });
});
