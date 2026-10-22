import { read, write } from './helpers';

const SPEC = 'test/e2e/issue-invoice.e2e.spec.ts';

const GENERATED_ACTION = `    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.post('/invoices', {}), 201);
    });`;

/** The request, then what happens after its answer: the relay publishes both versions and shipping consumes them. */
const AWAITED_ACTION = `    const trace = await tracing.traceOf(async () => {
      expectStatus(await ada.post('/invoices', {}), 201);

      await eventually(() => {
        const ended = JSON.stringify(tracing.spans());

        expect(ended.split('"name":"process shipping.billing-invoice-issued"')).toHaveLength(3);
        expect(ended).toContain('"name":"command PrepareParcelCommand"');
      }, { timeoutMs: 10_000 });
    });`;

const GENERATED_TREE = `      {
        name: 'POST /invoices',
        kind: 'SERVER',
        children: [{ name: 'command IssueInvoiceCommand', children: [{ name: 'repository InvoiceRepository.save' }] }],
      },`;

/** One action, one trace: the save records the fact, at the end of the unit of work each publisher appends to the outbox, the relay publishes later and shipping consumes, in the same trace. */
const WHOLE_TREE = `      {
        name: 'POST /invoices',
        kind: 'SERVER',
        attributes: { 'http.response.status_code': 201 },
        children: [
          {
            name: 'command IssueInvoiceCommand',
            attributes: { 'app.context': 'billing', 'app.outcome': 'succeeded' },
            children: [{ name: 'repository InvoiceRepository.save' }, { name: 'unit-of-work before-commit', children: [{ name: 'domain-event billing.invoice.issued', children: handlers }] }],
          },
        ],
      },`;

const HELPERS = `
const consumed = { name: 'process shipping.billing-invoice-issued', kind: 'CONSUMER', attributes: { 'app.context': 'shipping' } } as const;

const handlers: ExpectedSpan[] = [
  { name: 'handler InvoiceIssuedEventHandler' },
  { name: 'handler InvoiceIssuedV2Publisher', children: crossing({ name: 'command PrepareParcelCommand', attributes: { 'app.context': 'shipping' } }) },
  { name: 'handler InvoiceIssuedPublisher', children: crossing() },
];

/** What one publisher of billing causes: the append inside the request, the publication by the relay, then shipping. */
function crossing(...sent: readonly ExpectedSpan[]): ExpectedSpan[] {
  const published = { name: 'publish billing.invoice.issued', kind: 'PRODUCER', children: [{ ...consumed, children: sent }] } as const;

  return [{ name: 'outbox append billing.invoice.issued', children: [published] }];
}
`;

/**
 * The generated end-to-end spec asserts the trace of the request as far as the generator knew
 * it. Once the invoice records its fact, the team extends that assertion to the whole story,
 * as the comment above the generated assertion asks: nothing the generator should have written.
 */
export function assertTheWholeTrace(root: string): void {
  const spec = read(root, SPEC);

  const edited = spec
    .replace(
      "import { afterAll, beforeAll, beforeEach, describe, it, onTestFailed } from 'vitest';",
      "import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';",
    )
    .replace(
      "import { expectStatus } from '@ddd-ts-kit/testing/e2e';",
      "import { eventually, expectStatus } from '@ddd-ts-kit/testing/e2e';",
    )
    .replace(
      "import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';",
      "import { expectSpanTree, installTestTracing, type ExpectedSpan } from '@ddd-ts-kit/tracing/testing';",
    )
    .replace(GENERATED_ACTION, AWAITED_ACTION)
    .replace(GENERATED_TREE, WHOLE_TREE)
    .replace("\ndescribe('", `${HELPERS}\ndescribe('`);

  for (const expected of [AWAITED_ACTION, WHOLE_TREE, HELPERS, 'type ExpectedSpan']) {
    if (!edited.includes(expected)) {
      throw new Error(`${SPEC} no longer holds what the proof extends: update test/first-class-trace.ts.`);
    }
  }

  write(root, SPEC, edited);
}
