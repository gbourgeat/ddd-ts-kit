import { beforeAll, describe, expect, it } from 'vitest';
import { cli, EXPLICIT_STACK, scaffoldEverything, tempDir } from './helpers.js';
import { jsonAt } from './support/json-at.js';

const STYLES = [
  ['declared', undefined],
  ['explicit', EXPLICIT_STACK],
] as const;

const projects = new Map<string, string>();

describe.each(STYLES)('describe, in a %s project', (style, stack) => {
  let root: string;

  beforeAll(() => {
    root = projectIn(style, stack);
  });

  it('gives each use case its permission, or public', () => {
    expect(jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'useCases')).toEqual([
      {
        kind: 'command',
        name: 'CancelInvoice',
        permission: 'invoice.cancel',
        file: 'src/contexts/billing/application/commands/cancel-invoice',
      },
      {
        kind: 'command',
        name: 'IssueInvoice',
        permission: 'invoice.issue',
        file: 'src/contexts/billing/application/commands/issue-invoice',
      },
      {
        kind: 'query',
        name: 'ListInvoices',
        permission: 'invoice.list',
        file: 'src/contexts/billing/application/queries/list-invoices',
      },
    ]);

    expect(jsonAt(cli(root, 'describe', 'order-fulfilment', '--json').json(), 'useCases')).toContainEqual(
      expect.objectContaining({ name: 'TrackPurchaseOrder', permission: 'public' }),
    );
  });

  it('gives each route its method, path, operation, use case, permission, schema names and error codes', () => {
    const routes = jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'routes');

    expect(routes).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/invoices',
        operationId: 'listInvoices',
        useCase: 'ListInvoices',
        permission: 'invoice.list',
        request: [{ part: 'query', schema: 'query' }],
        responses: [{ status: 200, schema: 'page of line' }],
      }),
      expect.objectContaining({
        method: 'POST',
        path: '/invoices',
        operationId: 'issueInvoice',
        useCase: 'IssueInvoice',
        permission: 'invoice.issue',
        request: [{ part: 'body', schema: 'body' }],
        responses: [{ status: 201, schema: 'accepted' }],
        errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      }),
      expect.objectContaining({
        method: 'DELETE',
        path: '/invoices/:invoiceId',
        useCase: 'CancelInvoice',
        responses: [{ status: 204, schema: '' }],
        file: 'src/contexts/billing/presentation/http/cancel-invoice.route.ts',
      }),
    ]);
  });

  it('gives each published event its versions and its publishers', () => {
    expect(jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'publishedEvents')).toEqual([
      {
        type: 'billing.invoice.issued',
        versions: [1, 2],
        publishers: ['InvoiceIssuedPublisher', 'InvoiceIssuedV2Publisher'],
      },
    ]);
  });

  it('gives each consumed event its version, its producer, its handler and its consumer name', () => {
    expect(jsonAt(cli(root, 'describe', 'shipping', '--json').json(), 'consumedEvents')).toContainEqual({
      type: 'billing.invoice.issued',
      version: 2,
      from: 'billing',
      handler: 'BillingInvoiceIssuedIntegrationHandler',
      consumer: 'shipping.billing-invoice-issued',
      file: 'src/contexts/shipping/application/integration/handlers/billing-invoice-issued.integration-handler.ts',
    });
  });
});

describe.each(STYLES)('describe, in a %s project, beyond its use cases and events', (style, stack) => {
  let root: string;

  beforeAll(() => {
    root = projectIn(style, stack);
  });

  it('gives each port its kind and its adapters, each policy its permission, each gateway its upstream', () => {
    const billing = cli(root, 'describe', 'billing', '--json').json();
    const shipping = cli(root, 'describe', 'shipping', '--json').json();

    expect(jsonAt(billing, 'ports')).toEqual(
      expect.arrayContaining([
        {
          name: 'InvoiceRepository',
          kind: 'repository',
          adapters: ['DrizzleInvoiceRepository'],
          file: 'src/contexts/billing/domain/repositories/invoice.repository.ts',
        },
        {
          name: 'PaymentGateway',
          kind: 'external',
          adapters: ['RemotePaymentGateway'],
          file: 'src/contexts/billing/application/ports/payment-gateway.port.ts',
        },
      ]),
    );

    expect(jsonAt(billing, 'policies')).toEqual([
      {
        name: 'OnlyIssuerCancels',
        permission: 'invoice.cancel',
        file: 'src/contexts/billing/application/authorization/only-issuer-cancels.policy.ts',
      },
    ]);

    expect(jsonAt(shipping, 'gateways')).toEqual([
      expect.objectContaining({
        name: 'InvoiceStatusGateway',
        upstream: 'billing',
        adapters: expect.arrayContaining(['InProcessInvoiceStatusGateway']),
      }),
    ]);
  });

  it('gives the relationships of the config, and where the contracts with the fields are', () => {
    const shipping = cli(root, 'describe', 'shipping', '--json').json();

    expect(shipping).toMatchObject({
      name: 'shipping',
      classification: 'supporting',
      deployable: true,
      doc: 'src/contexts/shipping/CONTEXT.md',
      upstreams: [{ context: 'billing', relationship: 'customer-supplier' }],
      downstreams: [],
      contracts: { openapi: 'openapi/openapi.json', eventCatalog: 'docs/integration/event-catalog.md' },
    });

    expect(JSON.stringify(shipping)).not.toContain(root);
  });

  it('prints the same facts as text', () => {
    const text = cli(root, 'describe', 'billing').stdout;

    expect(text).toContain('billing [core]');
    expect(text).toContain('    command IssueInvoice (invoice.issue)');

    expect(text).toContain(
      '    POST /invoices issueInvoice -> IssueInvoice (invoice.issue); request: body; responses: 201 accepted; errors: UNAUTHORIZED, FORBIDDEN',
    );

    expect(text).toContain('    billing.invoice.issued v1, v2, by InvoiceIssuedPublisher, InvoiceIssuedV2Publisher');
    expect(text).toContain('    OnlyIssuerCancels (on invoice.cancel)');
  });

  it('refuses a context the config does not know, as the other commands do', () => {
    const unknown = cli(root, 'describe', 'catalog');

    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Unknown context "catalog".');
    expect(unknown.stderr).toContain('Use one of: billing, shipping, order-fulfilment.');
    expect(cli(root, 'describe').stderr).toContain('A context name is expected.');
  });

  it('list --context keeps one context and the end-to-end specs of its use cases', () => {
    const one = cli(root, 'list', '--context', 'billing', '--json').json();

    expect(jsonAt(one, 'contexts')).toEqual([expect.objectContaining({ name: 'billing' })]);
    expect(jsonAt(one, 'e2e')).toEqual(['issue-invoice']);
    expect(cli(root, 'list', '--context', 'shipping').stdout).toMatch(/^shipping \[supporting\]/);
    expect(cli(root, 'list', '--context', 'shipping').stdout).not.toContain('billing [core]');
    expect(cli(root, 'list', '--context', 'catalog').code).toBe(2);
  });
});

/** The project of a style, scaffolded once for the whole file. */
function projectIn(style: string, stack: (typeof STYLES)[number][1]): string {
  const known = projects.get(style);

  if (known !== undefined) {
    return known;
  }

  const root = tempDir(`describe-${style}`);

  scaffoldEverything(root, stack);
  projects.set(style, root);

  return root;
}
