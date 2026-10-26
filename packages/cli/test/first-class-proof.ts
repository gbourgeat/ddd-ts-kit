import { assertTheWholeTrace } from './first-class-trace';
import { cli, exists, read, write } from './helpers';

const SHIPPING_HANDLER =
  'src/contexts/shipping/application/integration/handlers/billing-invoice-issued.integration-handler.ts';

const SHIPPING_HANDLER_SPEC = 'src/contexts/shipping/test/unit/billing-invoice-issued.integration-handler.spec.ts';

const DECLARED_READER =
  'src/contexts/billing/infrastructure/persistence/in-memory-search-invoices-reader.repository.ts';

const EXPLICIT_READER = 'src/contexts/billing/infrastructure/persistence/in-memory-search-invoices.reader.ts';
const LINES = "[{ id: 'invoice-1' }, { id: 'invoice-2' }, { id: 'invoice-3' }]";

/**
 * What a team writes after `init` and `generate` in the project of the first-class stack, kept
 * to the minimum the proof needs: the aggregate records its birth fact, the list reads three
 * lines, the relationship schema knows the listed element, shipping prepares a parcel when
 * billing issues an invoice, and the generated trace assertion is extended to that whole story. Nothing here repairs generated code: each edit answers a
 * `TODO(domain)` or a `TODO(platform)` the generator left, in either style.
 */
export function writeBusinessDecisions(root: string): void {
  const prepared = cli(
    root,
    'generate',
    'command',
    'shipping',
    'PrepareParcel',
    '--public',
    '--term',
    'Prepare=To get a parcel ready for its carrier',
  );

  if (prepared.code !== 0) {
    throw new Error(`generate command shipping PrepareParcel failed: ${prepared.stderr}`);
  }

  edit(root, SHIPPING_HANDLER, [
    [
      /(import \{[^}]*\} from '@ddd-ts-kit\/kernel';\n)/,
      "$1import { PrepareParcelCommand } from '@/contexts/shipping/application/commands/prepare-parcel/prepare-parcel.command';\n",
    ],
    [
      /(async handle\(event: InvoiceIssuedV2\): Promise<void> \{\n)[^\n]*\n/,
      '$1    await this.commands.execute(new PrepareParcelCommand());\n',
    ],
  ]);

  // The generated spec hands the handler an event: now that the handler sends a command, the bus of the spec knows it.
  edit(root, SHIPPING_HANDLER_SPEC, [
    [
      /(import \{ BillingInvoiceIssuedIntegrationHandler \} from '([^']*)contexts\/shipping\/[^\n]*\n)/,
      "$1import { PrepareParcelCommand } from '$2contexts/shipping/application/commands/prepare-parcel/prepare-parcel.command';\n",
    ],
    [
      /const handler = new (\w+)\(new InMemoryCommandBus\(\)\);\n(\s+const meta)/,
      'const commands = new InMemoryCommandBus().register(PrepareParcelCommand, { execute: async () => undefined });\n    const handler = new $1(commands);\n$2',
    ],
  ]);

  edit(root, exists(root, DECLARED_READER) ? DECLARED_READER : EXPLICIT_READER, [
    ['readonly SearchInvoicesItem[] = []', `readonly SearchInvoicesItem[] = ${LINES}`],
  ]);

  edit(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts', [
    [
      "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
      "import { AggregateRoot } from '@ddd-ts-kit/kernel';\nimport { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event';",
    ],
    [
      '    const created = new Invoice(id, { registeredAt: now });',
      '    const created = new Invoice(id, { registeredAt: now });\n\n    created.record(new InvoiceIssued(id, now));',
    ],
  ]);

  // The gate of the search is held on the context, the scope on the element: two permissions, since the invoice no longer leaves its view to the operators.
  edit(root, 'src/contexts/billing/billing.permissions.ts', [
    [
      "  'invoice.search': { description: 'Search invoices' },\n",
      "  'invoice.search': { description: 'Search invoices' },\n  'invoice.view': { description: 'View invoice' },\n",
    ],
  ]);

  // CONTEXT.md lists the permissions of the context.
  if (cli(root, 'docs').code !== 0) {
    throw new Error('docs refused the permission the proof adds.');
  }

  edit(root, 'src/contexts/billing/application/queries/search-invoices/search-invoices.handler.ts', [
    ["billingPermissions['invoice.search'], 'invoice'", "billingPermissions['invoice.view'], 'invoice'"],
  ]);

  // The generated spec holds the permission of the scope too, with the role of its actor.
  edit(root, 'src/contexts/billing/test/unit/search-invoices.handler.spec.ts', [
    [
      "roles: { holder: [billingPermissions['invoice.search']] }",
      "roles: { holder: [billingPermissions['invoice.search'], billingPermissions['invoice.view']] }",
    ],
  ]);

  // The schema knows the invoice and who views it: the derived relation named after the search permission grants it.
  edit(root, 'src/platform/auth/relationships/relationship-schema.ts', [
    [/^import \{ permissions \}.*$/m, `$&\n${importOfBillingPermissions(root)}`],
    [
      'const elements: SchemaDefinition = {};',
      "const elements: SchemaDefinition = {\n  invoice: {\n    relations: { viewer: ['user'] },\n    derived: { [billingPermissions['invoice.view'].id]: 'viewer' },\n  },\n};",
    ],
  ]);

  assertTheWholeTrace(root);
  write(root, 'test/e2e/first-class.e2e.spec.ts', PROOF_SPEC);
}

/** The import of the permission set of billing, as the generated registry of permissions writes it. */
function importOfBillingPermissions(root: string): string {
  const line = /^import \{ billingPermissions \}.*$/m.exec(
    read(root, 'src/platform/auth/authorization/permissions.ts'),
  );

  if (line === null) {
    throw new Error('src/platform/auth/authorization/permissions.ts no longer imports the permission set of billing.');
  }

  return line[0];
}

function edit(root: string, file: string, replacements: readonly (readonly [string | RegExp, string])[]): void {
  let content = read(root, file);

  for (const [from, to] of replacements) {
    const next = content.replace(from, to);

    if (next === content) {
      throw new Error(`${file} no longer holds what the proof edits: ${String(from)}`);
    }

    content = next;
  }

  write(root, file, content);
}

/** The proof itself, run by the generated project: what a client and another context observe, never the database. */
const PROOF_SPEC = `import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collectEvents, eventually, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

interface Page<Line> {
  readonly items: readonly Line[];
  readonly total?: number;
  readonly nextCursor?: string;
}

interface Entry {
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly origin: string;
}

describe('The first-class stack, end to end', () => {
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
  });

  async function operatorOf(context: string, id: string): Promise<HttpClient> {
    await application.relate({ object: 'context:' + context, relation: 'operator', subject: 'user:' + id });

    return application.as({ id });
  }

  async function entriesOf(correlationId: string): Promise<readonly Entry[]> {
    const auditor = await operatorOf('audit', 'auditor');
    const response = expectStatus(await auditor.get<Page<Entry>>('/audit/entries?limit=100&correlationId=' + correlationId), 200);

    return response.body.items;
  }

  it('lists one page of what the access scope of the actor covers, and nothing else', async () => {
    const ada = await operatorOf('billing', 'ada');

    await application.relate({ object: 'invoice:invoice-1', relation: 'viewer', subject: 'user:ada' });
    await application.relate({ object: 'invoice:invoice-3', relation: 'viewer', subject: 'user:ada' });

    const first = expectStatus(await ada.get<Page<{ id: string }>>('/invoices?limit=1'), 200);
    const second = expectStatus(await ada.get<Page<{ id: string }>>('/invoices?limit=1&offset=1'), 200);

    expectStatus(await ada.get('/invoices?limit=0'), 422);

    expect(first.body).toEqual({ items: [{ id: 'invoice-1' }], total: 2 });
    expect(second.body).toEqual({ items: [{ id: 'invoice-3' }], total: 2 });
  });

  it('records an allowed and a denied decision, each readable through the audit route under the correlation id of its request', async () => {
    const ada = await operatorOf('billing', 'ada');
    const stranger = await application.as({ id: 'stranger' });
    const allowed = 'proof-allowed-' + Date.now();
    const denied = 'proof-denied-' + Date.now();

    expectStatus(await ada.withHeaders({ 'x-correlation-id': allowed }).post('/invoices', {}), 201);
    expectStatus(await stranger.withHeaders({ 'x-correlation-id': denied }).post('/invoices', {}), 403);

    expect(await entriesOf(allowed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'authorization', action: 'billing:invoice.issue', outcome: 'allowed', actorId: 'ada', origin: 'http' }),
      expect.objectContaining({ category: 'command', action: 'IssueInvoiceCommand', outcome: 'succeeded', actorId: 'ada' }),
    ]));

    expect(await entriesOf(denied)).toEqual([expect.objectContaining({ category: 'authorization', action: 'billing:invoice.issue', outcome: 'denied', actorId: 'stranger' })]);
  });

  it('carries the correlation id of the request to the published integration event and to its audit entry', async () => {
    const ada = await operatorOf('billing', 'ada');
    const published = collectEvents(application.events, ['billing.invoice.issued']);
    const correlationId = 'proof-event-' + Date.now();

    expectStatus(await ada.withHeaders({ 'x-correlation-id': correlationId }).post('/invoices', {}), 201);

    await eventually(async () => {
      expect(published.received().filter((event) => event.correlationId === correlationId).map((event) => event.version).sort()).toEqual([1, 2]);
      expect(await entriesOf(correlationId)).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'integration-event', action: 'billing.invoice.issued', outcome: 'succeeded', origin: 'event' })]));
    }, { timeoutMs: 10_000 });
  });

  it('carries an integration event from billing to shipping: outbox, relay, event bus, and the command the handler of shipping executes, once', async () => {
    const ada = await operatorOf('billing', 'ada');
    const correlationId = 'proof-crossing-' + Date.now();

    expectStatus(await ada.withHeaders({ 'x-correlation-id': correlationId }).post('/invoices', {}), 201);

    await eventually(async () => {
      const prepared = (await entriesOf(correlationId)).filter((entry) => entry.action === 'PrepareParcelCommand');

      expect(prepared).toEqual([expect.objectContaining({ category: 'command', outcome: 'succeeded', actorId: 'system:shipping.billing-invoice-issued', origin: 'event' })]);
    }, { timeoutMs: 20_000 });
  });

  it('refuses the audit trail to an actor who does not hold audit:trail.read', async () => {
    const ada = await operatorOf('billing', 'ada');

    expectStatus(await application.client.get('/audit/entries'), 401);
    expectStatus(await ada.get('/audit/entries'), 403);
  });
});
`;
