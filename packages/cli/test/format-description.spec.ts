import { describe, expect, it } from 'vitest';
import type { ContextDescription, RouteFact } from '../src/describe/context-description';
import { formatDescription } from '../src/describe/format-description';

const ROUTE: RouteFact = {
  method: 'POST',
  path: '/invoices',
  operationId: 'issueInvoice',
  group: '',
  guards: [],
  useCase: 'IssueInvoice',
  permission: 'invoice.issue',
  request: [{ part: 'body', schema: 'IssueInvoiceBody' }],
  responses: [{ status: 201, schema: 'IssuedInvoice' }],
  errors: ['invoice.already-issued'],
  file: 'issue-invoice.route.ts',
};

function described(overrides: Partial<ContextDescription> = {}): ContextDescription {
  return {
    name: 'billing',
    classification: 'core',
    purpose: '',
    deployable: false,
    doc: 'src/contexts/billing/CONTEXT.md',
    glossary: ['Invoice'],
    upstreams: [],
    downstreams: [],
    aggregates: [],
    eventSourced: [],
    domainEvents: [],
    permissions: [],
    useCases: [],
    routes: [],
    consumedEvents: [],
    publishedEvents: [],
    ports: [],
    policies: [],
    errors: [],
    projections: [],
    gateways: [],
    jobs: [],
    backgroundJobs: [],
    stateMachines: [],
    processes: [],
    contracts: { openapi: 'openapi.yaml', eventCatalog: 'docs/events.md' },
    ...overrides,
  };
}

describe('a context as describe prints it for a reader', () => {
  it('names the lines of CONTEXT.md people write, above its generated Reference', () => {
    expect(formatDescription(described({ docHead: 76 }))).toContain(
      '  language: src/contexts/billing/CONTEXT.md:1-76 (1 term)',
    );
  });

  it('says what is not written and what it does not hold', () => {
    expect(formatDescription(described()).split('\n').slice(0, 6)).toEqual([
      'billing [core]',
      '  purpose: not written',
      '  language: src/contexts/billing/CONTEXT.md (1 term)',
      '  upstreams: none',
      '  downstreams: none',
      '  aggregates: none',
    ]);
  });

  it('names the schema of each part a route reads, and a route that no guard stands before', () => {
    const text = formatDescription(described({ routes: [ROUTE] }));

    expect(text).toContain(
      '  routes:\n    POST /invoices issueInvoice -> IssueInvoice (invoice.issue); request: body IssueInvoiceBody; responses: 201 IssuedInvoice; errors: invoice.already-issued',
    );
  });

  it('says not read for what a reader could not find, and names a port not bound and a gateway to the outside', () => {
    const text = formatDescription(
      described({
        useCases: [{ kind: 'command', name: 'IssueInvoice', permission: '', file: 'issue-invoice.command.ts' }],
        routes: [{ ...ROUTE, useCase: '', permission: '', request: [], responses: [{ status: 204, schema: '' }] }],
        consumedEvents: [
          { type: '', version: null, from: '', handler: 'OnOrderPlaced', consumer: '', file: 'on-order-placed.ts' },
        ],
        ports: [{ name: 'TaxRates', kind: '', adapters: [], file: 'tax-rates.port.ts' }],
        gateways: [{ name: 'PaymentGateway', upstream: '', adapters: [], file: 'payment.gateway.ts' }],
      }),
    );

    expect(text).toContain('  use cases:\n    command IssueInvoice (not read)');

    expect(text).toContain(
      'POST /invoices issueInvoice -> not read (not read); request: none; responses: 204; errors:',
    );

    expect(text).toContain(
      '  consumed events:\n    not read from not read, handled by OnOrderPlaced (consumer not read)',
    );

    expect(text).toContain('  ports:\n    TaxRates [not bound]');
    expect(text).toContain('  gateways:\n    PaymentGateway to a system outside the repository');
  });

  it('names the version of a consumed event, the adapters of a port and the upstream of a gateway', () => {
    const text = formatDescription(
      described({
        consumedEvents: [
          {
            type: 'ordering.order-placed',
            version: 2,
            from: 'ordering',
            handler: 'OnOrderPlaced',
            consumer: 'billing.on-order-placed',
            file: 'on-order-placed.ts',
          },
        ],
        ports: [{ name: 'TaxRates', kind: 'gateway', adapters: ['HttpTaxRates'], file: 'tax-rates.port.ts' }],
        gateways: [{ name: 'Payments', upstream: 'payments', adapters: ['HttpPayments'], file: 'payments.gateway.ts' }],
      }),
    );

    expect(text).toContain(
      'ordering.order-placed v2 from ordering, handled by OnOrderPlaced (consumer billing.on-order-placed)',
    );

    expect(text).toContain('TaxRates [gateway], by HttpTaxRates');
    expect(text).toContain('Payments to payments, by HttpPayments');
  });
});
