import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir, write } from './helpers';
import { jsonAt } from './support/json-at';

const CONFIG = JSON.stringify({
  contexts: { ordering: { classification: 'core' }, billing: { classification: 'supporting' } },
});

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | skeleton | Order | \`generate aggregate ordering Order\` | | conductor | done |
| US5.02 | ordering | slice | Place order | \`generate command ordering PlaceOrder --aggregate Order --permission order.place\` | US5.01 | ordering | done |
| US5.03 | billing | slice | Invoice an order | \`generate integration-handler billing ordering ordering.order.placed\` | US5.02 | billing | todo |
`;

const REVIEW = 'docs/architecture/reviews/US5.md';
const STORY = 'docs/architecture/stories/US5.md';

const DESIGN = `# Design review of US5

## #US5.01 Order

\`Order\` holds its lines in \`domain/aggregates/order.aggregate.ts\`; \`Order.place()\` records the placement.
\`OrderLine\` was dropped: the lines are plain values.

## #US5.02 Place order

\`PlaceOrderCommand\` with the permission \`order.place\`, handled by \`PlaceOrderHandler\`, which reads the
\`Clock\` and answers an \`OrderSummary\`; its route lives in \`presentation/http/orders/\` and refuses
with \`OrderNumberTaken\`.

## #US5.03 Invoice an order

\`InvoiceOrderHandler\` reacts to \`ordering.order.placed\`.
`;

const AGGREGATE = `import type { Clock } from '@ddd-ts-kit/kernel';

export class Order {
  place(clock: Clock): void {
    clock.now();
  }
}
`;

const HANDLER = `export class PlaceOrderHandler {
  handle(): void {}
}
`;

function designedProject(): string {
  const root = tempDir('story-check-design');

  write(root, 'ddd-ts-kit.config.json', CONFIG);
  write(root, 'docs/architecture/slices.md', SLICES);
  write(root, REVIEW, DESIGN);
  write(root, 'src/contexts/ordering/domain/aggregates/order.aggregate.ts', AGGREGATE);

  write(
    root,
    'src/contexts/ordering/application/commands/place-order/place-order.command.ts',
    'export class PlaceOrderCommand {}\n',
  );

  write(root, 'src/contexts/ordering/application/commands/place-order/place-order.handler.ts', HANDLER);

  write(
    root,
    'src/contexts/ordering/presentation/http/orders/place-order.route.ts',
    'export class PlaceOrderRoute {}\n',
  );

  return root;
}

describe('story-check, the code against its design', () => {
  let root: string;

  beforeAll(() => {
    root = designedProject();
  });

  it('blocks on each name the section of a done row cites that the tree lacks, with its file:line in the review', () => {
    const check = cli(root, 'story-check', 'US5');

    expect(check.code).toBe(1);

    expect(check.stdout).toContain(
      'US5 cannot close: 1 row not done, 0 markers of its own left, 2 names of its design not in the code.',
    );

    expect(check.stdout).toContain(
      `Departed from its design (2): update the section of the row in ${REVIEW} to what it built, or list the name under \`### Compromises\` of \`## Report\` in docs/architecture/stories/US5.md with why`,
    );

    expect(check.stdout).toContain(
      `  ${REVIEW}:11  \`OrderSummary\`  (#US5.02, no class, interface, type or function OrderSummary is declared or imported under the source root)`,
    );

    expect(check.stdout).toContain(
      `  ${REVIEW}:12  \`OrderNumberTaken\`  (#US5.02, no class, interface, type or function OrderNumberTaken is declared or imported under the source root)`,
    );

    expect(check.stdout).not.toContain('InvoiceOrderHandler');
    expect(check.stdout).not.toContain('OrderLine');

    expect(jsonAt(cli(root, 'story-check', 'US5', '--json').json(), 'design')).toEqual([
      expect.objectContaining({ row: 'US5.02', document: REVIEW, line: 11, cited: 'OrderSummary', kind: 'symbol' }),
      expect.objectContaining({ row: 'US5.02', line: 12, cited: 'OrderNumberTaken', kind: 'symbol' }),
    ]);
  });

  it('reports a member the class lacks and a path that is not there, relative to the context or under the source root', () => {
    write(
      root,
      REVIEW,
      `${DESIGN.replace('`Order.place()` records', '`Order.cancel()` records').replace('`presentation/http/orders/`', '`presentation/http/cancellations/`')}\nSee \`src/contexts/ordering/domain/order-number.ts\` and \`Clock.tick\`.\n`,
    );

    const design = jsonAt(cli(root, 'story-check', 'US5', '--json').json(), 'design') as Array<Record<string, string>>;

    expect(design.map(({ cited, why }) => `${cited}: ${why}`)).toEqual([
      'Order.cancel: Order (src/contexts/ordering/domain/aggregates/order.aggregate.ts) has no member cancel',
      'OrderSummary: no class, interface, type or function OrderSummary is declared or imported under the source root',
      'presentation/http/cancellations/: no presentation/http/cancellations/ under src/contexts/ordering/',
      'OrderNumberTaken: no class, interface, type or function OrderNumberTaken is declared or imported under the source root',
    ]);

    write(root, REVIEW, DESIGN);
  });

  it('lets a compromise listed in the report excuse a name, and closes once each is settled', () => {
    write(
      root,
      STORY,
      '# US5\n\n## Report\n\nDelivered.\n\n### Compromises\n\n- `OrderSummary`: the page answers plain orders, the summary waits for US6.\n- `OrderNumberTaken()` is not raised yet: numbers are not unique in this version.\n\n### Decisions\n\n- `Nothing` here is a compromise.\n',
    );

    const check = cli(root, 'story-check', 'US5');

    expect(check.stdout).not.toContain('Departed from its design');
    expect(jsonAt(cli(root, 'story-check', 'US5', '--json').json(), 'design')).toEqual([]);

    write(
      root,
      'docs/architecture/slices.md',
      SLICES.replace('| US5.02 | ordering | todo |', '').replaceAll('| todo |', '| done |'),
    );

    write(root, 'src/contexts/billing/application/invoice-order.handler.ts', 'export class InvoiceOrderHandler {}\n');

    expect(cli(root, 'story-check', 'US5').code).toBe(0);

    write(root, STORY, '# US5\n\n## Report\n\nDelivered.\n');

    const reopened = cli(root, 'story-check', 'US5');

    expect(reopened.code).toBe(1);

    expect(reopened.stdout).toContain(
      'US5 cannot close: every row done, 0 markers of its own left, 2 names of its design not in the code.',
    );
  });
});
