// The texts of a story US5 the acceptance specs share.

export const SPEC = 'test/acceptance/us5.acceptance.spec.ts';
export const LOCK = 'test/acceptance/us5.acceptance.lock.json';
export const STORY = 'docs/architecture/stories/US5.md';

export const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | skeleton | Order | \`generate aggregate ordering Order\` | | conductor | done |
| US5.02 | ordering | slice | Place order | \`generate command ordering PlaceOrder --creates --aggregate Order --permission order.place\` | US5.01 | ordering | todo |
| US5.03 | billing | slice | Invoice a customer's order | \`generate integration-handler billing ordering ordering.order.placed\` | US5.02 | billing | todo |
| US6.01 | ordering | slice | Cancel order | \`generate command ordering CancelOrder --aggregate Order --permission order.cancel\` | | ordering | done |
`;

export const SPECIFICATION = `# US5 Order and invoice

## Acceptance criteria

- AC1: a customer places an order and reads its number
- AC2: the order placed is invoiced
  to its customer

## Decisions
`;

/** The spec of US5 once its scenarios are written, each in one of the forms a formatter leaves. */
export const WRITTEN = `import { describe, it } from 'vitest';
import { expectStatus, pending } from '@ddd-ts-kit/testing/e2e';

describe('US5, acceptance', () => {
  it('#US5.02 AC1 a customer places an order and reads its number', pending(async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  }));

  it(
    "#US5.03 AC2 the customer's order is invoiced",
    pending(async () => {
      // An invoice is announced once the order is placed.
      expectStatus({ status: 404, headers: {}, body: undefined }, 201);
    }),
  );
});
`;

/** The same scenarios once their rows are built: the wrapper gone, the formatter run again. */
export const BUILT = `import { describe, it } from 'vitest';
import { expectStatus } from '@ddd-ts-kit/testing/e2e';

describe('US5, acceptance', () => {
  it('#US5.02 AC1 a customer places an order and reads its number', async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  });

  it("#US5.03 AC2 the customer's order is invoiced", async () => {
    expectStatus({ status: 404, headers: {}, body: undefined }, 201);
  });
});
`;
