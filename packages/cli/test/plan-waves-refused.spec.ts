import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

/** A plan of `rows` written in the slices file of the project, then `plan-waves` with the flags. */
function planOf(root: string, rows: string, ...flags: string[]): ReturnType<typeof cli> {
  write(root, 'docs/architecture/slices.md', `${HEADER}${rows}`);

  return cli(root, 'plan-waves', ...flags);
}

/** billing, flat, with its aggregate Invoice; catalog, divided into the module pricing, with its aggregate Product. */
let root: string;

beforeAll(() => {
  root = initProject('--context', 'billing:core', '--context', 'catalog:supporting');

  cli(
    root,
    'generate',
    'aggregate',
    'billing',
    'Invoice',
    '--term',
    'Invoice=What a customer owes',
    '--term',
    'Pay=Settle an invoice',
    '--term',
    'Refund=Give back what a customer paid',
  );

  cli(root, 'generate', 'aggregate', 'catalog', 'Product', '--term', 'Product=An item offered for sale');
  cli(root, 'generate', 'module', 'catalog', 'pricing', '--term', 'Pricing=The setting of the price of products');
});

describe('plan-waves, a planned command the generator refuses', () => {
  it('refuses, with no wave, a command whose aggregate no row of the plan generates, with what the generator says', () => {
    const refused = planOf(
      root,
      '| US4.01 | billing | slice | Pay order | `generate command billing PayInvoice --aggregate Order --permission invoice.pay` | | billing | todo |\n',
      '--json',
    );

    expect(refused.code).toBe(1);

    expect(refused.json()).toMatchObject({
      problems: [
        {
          kind: 'refused-command',
          rows: ['US4.01'],
          command: 'generate command billing PayInvoice --aggregate Order --permission invoice.pay',
          refusal:
            'The aggregate Order does not exist in "billing" (src/contexts/billing/domain/aggregates/order.aggregate.ts).',
          fix: 'Create it first with `ddd-ts-kit generate aggregate billing Order`.',
          prerequisite: 'No row of the plan generates it: add that command to this row, or to a row it depends on.',
        },
      ],
      waves: [],
      mergeOrder: [],
    });

    expect(jsonAt(refused.json(), 'notReplayed')).toBeUndefined();
  });

  it('prints the refusal and the fix of the generator under the row, and asks to fix the rows', () => {
    const text = planOf(
      root,
      '| US4.01 | billing | slice | Pay order | `generate command billing PayInvoice --aggregate Order --permission invoice.pay` | | billing | todo |\n',
    ).stdout;

    expect(text.split('\n')).toEqual([
      'Waves (docs/architecture/slices.md): none, the generator refuses commands of these rows as written: fix the rows first',
      '  #US4.01 `generate command billing PayInvoice --aggregate Order --permission invoice.pay` is refused by the generator:',
      '    The aggregate Order does not exist in "billing" (src/contexts/billing/domain/aggregates/order.aggregate.ts).',
      '    fix: Create it first with `ddd-ts-kit generate aggregate billing Order`.',
      '    No row of the plan generates it: add that command to this row, or to a row it depends on.',
    ]);
  });
});

describe('plan-waves, the order of the commands a refused command builds on', () => {
  it('names the row that generates what a command builds on when the row does not wait for it, and passes once it does', () => {
    const credit = '`generate aggregate billing Credit --term "Credit=What billing owes a customer"`';
    const refund = '`generate command billing RefundInvoice --aggregate Credit --permission invoice.refund`';

    const rows = (dependsOn: string): string =>
      `| US5.01 | billing | slice | Refund invoice | ${refund} | ${dependsOn} | billing | todo |\n| US5.02 | billing | skeleton | Credit | ${credit} | | conductor | todo |\n`;

    const unordered = planOf(root, rows(''), '--json');

    expect(unordered.code).toBe(1);

    expect(jsonAt(unordered.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US5.01', 'US5.02'],
        prerequisite: '#US5.02 generates it, but #US5.01 does not wait for it: add US5.02 to its Depends on.',
      }),
    ]);

    expect(planOf(root, rows('US5.02')).code).toBe(0);
  });

  it('says to put first the command of a row that generates what an earlier command of the same row builds on', () => {
    const refused = planOf(
      root,
      '| US5.01 | billing | slice | Refund invoice | `generate command billing RefundInvoice --aggregate Credit --permission invoice.refund` then `generate aggregate billing Credit --term "Credit=What billing owes a customer"` | | billing | todo |\n',
      '--json',
    );

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        rows: ['US5.01'],
        prerequisite:
          'A later command of this row generates it: put `generate aggregate billing Credit --term "Credit=What billing owes a customer"` first.',
      }),
    ]);
  });

  it('says when the row that generates what a command builds on is refused itself', () => {
    const offer = '`generate aggregate catalog Offer --term "Offer=A price proposed for a product"`';

    const withdraw =
      '`generate command catalog WithdrawOffer --aggregate Offer --permission offer.withdraw --term "Withdraw=Take an offer back" --module pricing`';

    const refused = planOf(
      root,
      `| US6.10 | catalog | skeleton | Offer | ${offer} | | conductor | todo |\n| US6.11 | catalog | slice | Withdraw offer | ${withdraw} | US6.10 | catalog | todo |\n`,
      '--json',
    );

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({ rows: ['US6.10'], fix: expect.stringContaining('--module <pricing>') }),
      expect.objectContaining({
        rows: ['US6.11'],
        prerequisite: '#US6.10 would generate it, but the generator refuses that command too: fix it first.',
      }),
    ]);
  });
});

describe('plan-waves, a planned command refused for what the project is', () => {
  it('refuses a command that does not say its module in a context divided into modules, and passes once it does', () => {
    const revise = '`generate command catalog ReviseProduct --aggregate Product --permission product.revise';

    const row = (flags: string): string =>
      `| US6.01 | catalog | slice | Revise product | ${revise} --term "Revise=Change what a product says"${flags}\` | | catalog | todo |\n`;

    const refused = planOf(root, row(''), '--json');

    expect(refused.code).toBe(1);

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US6.01'],
        refusal: expect.stringContaining('"catalog" is divided into the modules of its model (pricing)'),
        fix: expect.stringContaining('--module <pricing>'),
        prerequisite: null,
      }),
    ]);

    expect(planOf(root, row(' --module pricing')).code).toBe(0);
  });
});

describe('plan-waves, a row in progress', () => {
  it('replays a row in progress without holding against the plan what the generator refuses of a second run, but not a row to do', () => {
    cli(root, 'generate', 'port', 'billing', 'PaymentProvider', '--term', 'Payment provider=Who moves the money');
    cli(root, 'generate', 'adapter', 'billing', 'PaymentProvider');

    const started = (status: string): string =>
      `| US7.01 | billing | skeleton | Payment provider | \`generate port billing PaymentProvider\` then \`generate adapter billing PaymentProvider\` | | conductor | ${status} |\n`;

    expect(planOf(root, started('in progress')).code).toBe(0);

    const todo = planOf(root, started('todo'), '--json');

    expect(todo.code).toBe(1);

    expect(jsonAt(todo.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US7.01'],
        command: 'generate adapter billing PaymentProvider',
        refusal: expect.stringContaining('PaymentProvider is already bound by'),
      }),
    ]);
  });
});

describe('plan-waves, a planned command refused on a project of relationships', () => {
  it('refuses a row that grants a role where the rights are relationships', () => {
    const rebac = initProject('--context', 'billing:core', '--authz', 'rebac');

    cli(rebac, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=What a customer owes');

    const refused = planOf(
      rebac,
      '| US8.01 | billing | slice | Pay invoice | `generate command billing PayInvoice --aggregate Invoice --permission invoice.pay --term "Pay=Settle an invoice" --grant user` | | billing | todo |\n',
      '--json',
    );

    expect(refused.code).toBe(1);

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        kind: 'refused-command',
        rows: ['US8.01'],
        refusal: expect.stringContaining('stack.authz is "rebac"'),
        fix: expect.stringContaining('without --grant'),
      }),
    ]);
  });
});
