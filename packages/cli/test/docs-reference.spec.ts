import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, scaffoldEverything, tempDir, write } from './helpers.js';

const BILLING = 'src/contexts/billing/CONTEXT.md';
const SHIPPING = 'src/contexts/shipping/CONTEXT.md';

describe('docs: the reference of a CONTEXT.md', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('docs-reference');
    scaffoldEverything(root, undefined, ['--routes', 'functions']);
  });

  it('is written by the generators, between its markers, under its own heading', () => {
    const doc = read(root, BILLING);

    expect(doc).toContain(
      '## Reference\n\n<!-- ddd-ts-kit:reference -->\nGenerated from the code by `ddd-ts-kit docs`',
    );

    expect(doc).toContain(
      '[OpenAPI](../../../openapi/openapi.yaml), [event catalog](../../../docs/integration/event-catalog.md)',
    );

    expect(doc.trimEnd().endsWith('<!-- /ddd-ts-kit:reference -->')).toBe(true);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('lists use cases, routes, publishers, ports and policies as tables', () => {
    const doc = read(root, BILLING);

    expect(doc).toContain('**Dependencies**: upstreams: none; downstreams: `shipping` (customer-supplier).');

    expect(doc).toContain(
      '### Use cases\n\n| Use case | Kind | Permission |\n|---|---|---|\n| `CancelInvoice` | command | `invoice.cancel` |',
    );

    expect(doc).toContain(
      '| POST | `/invoices` | `issueInvoice` | `IssueInvoice` | `invoice.issue` | body | 201: `acceptedSchema` | `UNAUTHORIZED`, `FORBIDDEN` |',
    );

    expect(doc).toContain(
      '### Publishers\n\n| Event | Versions | Publisher |\n|---|---|---|\n| `billing.invoice.issued` | 1, 2 | `InvoiceIssuedPublisher`, `InvoiceIssuedV2Publisher` |',
    );

    expect(doc).toContain('| `InvoiceRepository` | repository | `DrizzleInvoiceRepository` |');

    expect(doc).toContain(
      '### Policies\n\n| Policy | Permission |\n|---|---|\n| `OnlyIssuerCancels` | `invoice.cancel` |',
    );
  });

  it('lists consumed events and gateways, and leaves out the tables of what the context does not have', () => {
    const doc = read(root, SHIPPING);

    expect(doc).toContain('**Dependencies**: upstreams: `billing` (customer-supplier); downstreams: none.');

    expect(doc).toContain(
      '| `billing.invoice.issued` | 2 | `billing` | `BillingInvoiceIssuedIntegrationHandler` | `shipping.billing-invoice-issued` |',
    );

    expect(doc).toContain(
      '### Gateways\n\n| Gateway | Upstream | Adapters |\n|---|---|---|\n| `InvoiceStatusGateway` | `billing` | `InProcessInvoiceStatusGateway` |',
    );

    expect(doc).not.toContain('### Routes');
    expect(doc).not.toContain('### Policies');
  });

  it('is refreshed by generate, with the element it just created', () => {
    const generated = cli(
      root,
      'generate',
      'query',
      'billing',
      'GetInvoice',
      '--permission',
      'invoice.get',
      '--term',
      'Get=To read one invoice',
      '--json',
    );

    expect(generated.code).toBe(0);
    expect(read(root, BILLING)).toContain('| `GetInvoice` | query | `invoice.get` |');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('is found stale by docs --check when the code moved on, then repaired by docs', () => {
    const route = 'src/contexts/billing/presentation/http/issue-invoice.route.ts';

    write(
      root,
      route,
      read(root, route).replace(
        "errors: ['UNAUTHORIZED', 'FORBIDDEN']",
        "errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVOICE_ALREADY_ISSUED']",
      ),
    );

    const stale = cli(root, 'docs', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain(`stale  ${BILLING}`);
    expect(cli(root, 'docs').stdout).toContain(`updated      ${BILLING}`);
    expect(read(root, BILLING)).toContain('`UNAUTHORIZED`, `FORBIDDEN`, `INVOICE_ALREADY_ISSUED` |');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('is added after the last generated list of a CONTEXT.md written before it existed, and the text of people is kept', () => {
    const before = read(root, SHIPPING).replace(/\n## Reference[\s\S]*$/, '\n\n## Notes\n\nWritten by the team.\n');

    write(root, SHIPPING, before);
    expect(cli(root, 'docs', '--check').code).toBe(1);
    cli(root, 'docs');

    const after = read(root, SHIPPING);

    expect(after).toContain('<!-- /ddd-ts-kit:relationships -->\n\n## Reference\n\n<!-- ddd-ts-kit:reference -->');
    expect(after.trimEnd().endsWith('## Notes\n\nWritten by the team.')).toBe(true);
    expect(cli(root, 'check', '--rule', 'tree/context-doc').code).toBe(0);
  });
});
