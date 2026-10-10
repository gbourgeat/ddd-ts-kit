import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support.js';

const RULE = 'domain-events/dispatched-on-save';
const BILLING = 'src/contexts/billing';
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const QUERY_HANDLER = `${BILLING}/application/queries/invoices-issued/invoices-issued.handler.ts`;
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/pg-invoice.repository.ts`;
const MAPPER = `${BILLING}/infrastructure/persistence/invoice.mapper.ts`;
const GATEWAY = `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`;
const IMPORTED = "import { Clock, DomainEventDispatcher } from '@ddd-ts-kit/kernel';";
const DECLARATIONS = "import { CommandHandler, Repository } from '@ddd-ts-kit/kernel/declarations';";
const PULLED = 'const events = invoice.pullEvents();';

describe('domain-events/dispatched-on-save', () => {
  it('reports every call to pullEvents under application/ and infrastructure/', () => {
    const files = {
      [HANDLER]: lines(PULLED),
      [EVENT_HANDLER]: lines('', 'await dispatch(this.invoice?.pullEvents());'),
      [INTEGRATION_HANDLER]: lines(PULLED),
      [ADAPTER]: lines(PULLED),
      [GATEWAY]: lines(PULLED, PULLED),
    };

    expect(found(files)).toEqual([
      'application/commands/issue-invoice/issue-invoice.handler.ts:1 `pullEvents()` is called',
      'application/event-handlers/invoice-issued.event-handler.ts:2 `pullEvents()` is called',
      'application/integration/handlers/product-listed.integration-handler.ts:1 `pullEvents()` is called',
      'infrastructure/external/stripe-payment.gateway.ts:1 `pullEvents()` is called',
      'infrastructure/external/stripe-payment.gateway.ts:2 `pullEvents()` is called',
      'infrastructure/persistence/pg-invoice.repository.ts:1 `pullEvents()` is called',
    ]);
  });

  it('reports the dispatcher imported, listed and received in a command, a query and a repository adapter', () => {
    const handler = lines(
      IMPORTED,
      DECLARATIONS,
      '',
      '@CommandHandler(IssueInvoice, [InvoiceRepository, DomainEventDispatcher])',
      'export class IssueInvoiceHandler {',
      '  constructor(',
      '    private readonly dispatcher: DomainEventDispatcher,',
      '  ) {}',
      '}',
    );

    const adapter = lines(
      DECLARATIONS,
      '',
      '@Repository(InvoiceRepository, [DomainEventDispatcher])',
      'export class PgInvoiceRepository {',
      '  constructor(dispatcher: kernel.DomainEventDispatcher) {}',
      '}',
    );

    const query = lines('import type {', '  DomainEventDispatcher as Dispatcher,', "} from '@ddd-ts-kit/kernel';");

    expect(found({ [HANDLER]: handler, [ADAPTER]: adapter, [QUERY_HANDLER]: query })).toEqual([
      'application/commands/issue-invoice/issue-invoice.handler.ts:1 DomainEventDispatcher is imported',
      'application/commands/issue-invoice/issue-invoice.handler.ts:4 DomainEventDispatcher is named',
      'application/commands/issue-invoice/issue-invoice.handler.ts:6 The constructor of IssueInvoiceHandler receives a DomainEventDispatcher',
      'application/queries/invoices-issued/invoices-issued.handler.ts:2 DomainEventDispatcher is imported',
      'infrastructure/persistence/pg-invoice.repository.ts:3 DomainEventDispatcher is named',
      'infrastructure/persistence/pg-invoice.repository.ts:5 The constructor of PgInvoiceRepository receives a DomainEventDispatcher',
    ]);
  });

  it('leaves the dispatcher to event handlers, integration handlers and what is not a repository adapter', () => {
    expect(
      found({
        [EVENT_HANDLER]: lines(IMPORTED),
        [INTEGRATION_HANDLER]: lines(IMPORTED),
        [MAPPER]: lines(IMPORTED),
        [GATEWAY]: lines(IMPORTED),
      }),
    ).toEqual([]);
  });
});

describe('domain-events/dispatched-on-save, what it does not judge and what it says', () => {
  it('does not judge the domain, the tests, the module file, the platform, main.ts nor apps/', () => {
    const both = lines(IMPORTED, PULLED);

    const files = {
      [`${BILLING}/domain/aggregates/invoice.aggregate.ts`]: lines(
        'export class Invoice {',
        '  drain(): void {',
        '    this.pullEvents();',
        '  }',
        '}',
      ),
      [`${BILLING}/test/unit/issue-invoice.handler.spec.ts`]: both,
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.spec.ts`]: both,
      [`${BILLING}/billing.module.ts`]: both,
      'src/platform/dispatching-on-save.ts': both,
      'src/main.ts': both,
      'src/apps/billing/main.ts': both,
    };

    expect(found(files)).toEqual([]);
  });

  it('reads code only: a name in a comment, in a string or as a declaration is not a call', () => {
    const handler = lines(
      '// invoice.pullEvents() used to be here, with a DomainEventDispatcher',
      "const hint = 'aggregate.pullEvents()';",
      'class Outbox {',
      '  pullEvents(): void {}',
      '}',
    );

    expect(found({ [HANDLER]: handler })).toEqual([]);
  });

  it('says what to write instead, and obeys the config and a suppression', () => {
    const suppressed = lines(
      '// ddd-ts-kit-disable-next-line domain-events/dispatched-on-save -- ADR-0014: the import of legacy invoices replays their events',
      PULLED,
    );

    const root = projectWith({
      [HANDLER]: lines(PULLED),
      [GATEWAY]: suppressed,
      'docs/adr/0014-legacy-import.md': '# Decision\n',
    });

    const [violation] = reported(root, RULE);

    expect(reported(root, RULE)).toHaveLength(1);

    expect(violation?.message).toBe(
      '`pullEvents()` is called in application/commands: the events an aggregate recorded are dispatched when its repository saves it.',
    );

    expect(reported(projectWith({ [HANDLER]: lines(PULLED) }, { rules: { [RULE]: 'off' } }), RULE)).toEqual([]);
  });
});

function found(files: Readonly<Record<string, string>>): string[] {
  return reported(projectWith(files), RULE).map(
    ({ file, line, message }) =>
      `${file.slice(BILLING.length + 1)}:${line} ${message.slice(0, message.indexOf(' in '))}`,
  );
}
