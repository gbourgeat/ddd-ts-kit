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

/** billing, flat, with its aggregate Invoice and a port bound to its adapter; catalog, divided into the module pricing, with its aggregate Product. */
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
  cli(root, 'generate', 'port', 'billing', 'PaymentProvider', '--term', 'Payment provider=Who moves the money');
  cli(root, 'generate', 'adapter', 'billing', 'PaymentProvider');
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
          prerequisite:
            'No row of the plan generates it as the rows are written: add the command the fix names to this row or to a row it depends on, or fix the refused row that would generate it.',
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
      'Waves (docs/architecture/slices.md): none, a worker following these rows as written would be refused: fix the rows first',
      '  #US4.01 `generate command billing PayInvoice --aggregate Order --permission invoice.pay` is refused by the generator:',
      '    The aggregate Order does not exist in "billing" (src/contexts/billing/domain/aggregates/order.aggregate.ts).',
      '    fix: Create it first with `ddd-ts-kit generate aggregate billing Order`.',
      '    No row of the plan generates it as the rows are written: add the command the fix names to this row or to a row it depends on, or fix the refused row that would generate it.',
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

describe('plan-waves, a command written with a flag before its kind', () => {
  it('reads the kind after a leading flag that takes a value, as the generator does, and replays it', () => {
    const reprice =
      '`generate command catalog RepriceProducts --aggregate Product --permission product.reprice --term "Reprice=Set the price of products again" --module pricing`';

    const job = '`generate --module pricing job catalog Reprice --every 15m --command RepriceProducts`';

    const replayed = planOf(
      root,
      `| US6.20 | catalog | slice | Reprice products | ${reprice} | | catalog | todo |\n| US6.21 | catalog | slice | Reprice job | ${job} | US6.20 | catalog | todo |\n`,
      '--json',
    );

    expect(jsonAt(replayed.json(), 'problems')).toEqual([]);
    expect(replayed.code).toBe(0);
  });
});

describe('plan-waves, a row in progress', () => {
  it('replays a row in progress without holding against the plan what the generator refuses of a second run, but not a row to do', () => {
    const started = (status: string): string =>
      `| US7.01 | billing | skeleton | Payment provider | \`generate port billing PaymentProvider\` then \`generate adapter billing PaymentProvider\` | | conductor | ${status} |\n`;

    const inProgress = planOf(root, started('in progress'), '--json');

    expect(inProgress.code).toBe(0);

    expect(inProgress.json()).toMatchObject({
      problems: [],
      started: [
        {
          row: 'US7.01',
          command: 'generate adapter billing PaymentProvider',
          refusal: expect.stringContaining('PaymentProvider is already bound by'),
          fix: expect.stringContaining('A port has one adapter'),
        },
      ],
    });

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

describe('plan-waves for a reader, a row in progress', () => {
  it('says apart, as not counted, what the generator refused in a row in progress, with its fix', () => {
    const text = planOf(
      root,
      '| US7.01 | billing | skeleton | Payment provider | `generate adapter billing PaymentProvider` | | conductor | in progress |\n',
    ).stdout;

    expect(text).toContain(
      [
        'Refused in rows in progress, not counted: their commands may have run already',
        '  #US7.01 `generate adapter billing PaymentProvider`:',
        '    PaymentProvider is already bound by infrastructure/external/remote-payment-provider.adapter.ts.',
      ].join('\n'),
    );

    expect(text).toContain('    fix: A port has one adapter.');
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

  it('says both what to wait for and the refusal that follows, when the row grants a role and its aggregate is generated later', () => {
    const rebac = initProject('--context', 'billing:core', '--authz', 'rebac');

    cli(rebac, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=What a customer owes');

    const pay =
      '`generate command billing PayInvoice --aggregate Credit --permission invoice.pay --term "Pay=Settle an invoice" --grant user`';

    const credit = '`generate aggregate billing Credit --term "Credit=What billing owes a customer"`';

    const refused = planOf(
      rebac,
      `| US8.01 | billing | slice | Pay invoice | ${pay} | | billing | todo |\n| US8.02 | billing | skeleton | Credit | ${credit} | | conductor | todo |\n`,
      '--json',
    );

    expect(jsonAt(refused.json(), 'problems')).toEqual([
      expect.objectContaining({
        rows: ['US8.01', 'US8.02'],
        refusal: expect.stringContaining('The aggregate Credit does not exist'),
        prerequisite: expect.stringContaining('add US8.02 to its Depends on'),
        nextRefusal: {
          refusal: expect.stringContaining('stack.authz is "rebac"'),
          fix: expect.stringContaining('without --grant'),
        },
      }),
    ]);
  });
});
