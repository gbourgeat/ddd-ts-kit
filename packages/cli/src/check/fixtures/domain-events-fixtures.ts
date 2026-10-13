import { DECLARED } from './declared.js';
import { DECLARED_CONTEXT } from './declared-context.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';
import { source } from './source.js';
import { withoutFile } from './without-file.js';

const { ADAPTER, AGGREGATE_SPEC, BILLING, EVENT, EVENT_HANDLER, EVENT_HANDLER_SPEC, HANDLER, MODULE, PAYMENT_ADAPTER } =
  PATHS;

const RULE = 'domain-events/dispatched-on-save';
const TRANSACTIONAL = 'domain-events/transactional-before-commit';
const KERNEL = "'@ddd-ts-kit/kernel'";
const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";

const SAVING_ADAPTER = source(
  `import { Repository } from ${DECLARATIONS};`,
  "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
  '',
  '@Repository(InvoiceRepository, [])',
  'export class InMemoryInvoiceRepository implements InvoiceRepository {',
  '  async save(invoice: Invoice): Promise<void> {',
  '    await this.dispatch(invoice.pullEvents());',
  '  }',
  '}',
);

const PULLING_EVENT_HANDLER = source(
  `import { DomainEventDispatcher } from ${KERNEL};`,
  `import { DomainEventHandler } from ${DECLARATIONS};`,
  "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';",
  '',
  "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [DomainEventDispatcher])",
  'export class InvoiceIssuedEventHandler {',
  '  async handle(event: InvoiceIssued): Promise<void> {',
  '    await this.dispatcher.dispatch(event.invoice.pullEvents());',
  '  }',
  '}',
);

const DISPATCHED_ON_SAVE: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a handler that saves and nothing else, events read in a spec and dispatched by the platform',
    expect: 'pass',
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [HANDLER]: handlerDoing([], ['await this.invoices.save(command.invoice);']),
      [AGGREGATE_SPEC]:
        "import { expect, it } from 'vitest';\n\nit('records nothing twice', () => {\n  expect(invoice.pullEvents()).toEqual([]);\n});\n",
      'src/platform/dispatching-on-save.ts': `import { DomainEventDispatcher } from ${KERNEL};\n\nexport const dispatched = (dispatcher: DomainEventDispatcher, saved: Saved): Promise<void> => dispatcher.dispatch(saved.pullEvents());\n`,
    }),
  },
  {
    ruleId: RULE,
    name: 'a command handler pulling the events of the aggregate it saved',
    expect: { file: HANDLER },
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [HANDLER]: handlerDoing(
        [],
        ['await this.invoices.save(command.invoice);', 'await this.announce(command.invoice.pullEvents());'],
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'a command handler given the dispatcher',
    expect: { file: HANDLER },
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [HANDLER]: handlerDoing(['DomainEventDispatcher'], ['await this.invoices.save(command.invoice);']),
    }),
  },
  {
    ruleId: RULE,
    name: 'a repository adapter dispatching what it saved',
    expect: { file: ADAPTER },
    files: declaredProject({ ...DECLARED_CONTEXT, [ADAPTER]: SAVING_ADAPTER }),
  },
  {
    ruleId: RULE,
    name: 'a domain event handler pulling events, the dispatcher it may hold aside',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({ ...DECLARED_CONTEXT, [EVENT_HANDLER]: PULLING_EVENT_HANDLER }),
  },
];

const FROM_KERNEL = (...names: string[]): string => `import { ${names.join(', ')} } from ${KERNEL};`;

const REPOSITORY_PORT =
  "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';";

const PAYMENT_PORT = "import { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port.js';";

const AFTER_COMMIT = "phase: 'after-commit'";
const STORED_PAYMENTS = `${BILLING}/infrastructure/persistence/stored-payment-gateway.repository.ts`;

/** The payment port kept in the database of the context: its adapter lives with the repositories. */
const STORED_ADAPTER = source(
  `import { Repository } from ${DECLARATIONS};`,
  "import { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port.js';",
  '',
  '@Repository(PaymentGateway, [])',
  'export class StoredPaymentGateway implements PaymentGateway {}',
);

/** The handler of the explicit style: no decorator, the cache it clears typed in its constructor. */
const PLAIN_EVENT_HANDLER = source(
  `import type { Cache } from ${KERNEL};`,
  "import type { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';",
  '',
  'export class InvoiceIssuedEventHandler {',
  '  constructor(private readonly cache: Cache) {}',
  '',
  '  async handle(event: InvoiceIssued): Promise<void> {',
  '    await this.cache.delete(event.name);',
  '  }',
  '}',
);

const TRANSACTIONAL_BEFORE_COMMIT: readonly Fixture[] = [
  {
    ruleId: TRANSACTIONAL,
    name: 'a before-commit handler given a repository and the outbox publisher',
    expect: 'pass',
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [EVENT_HANDLER]: reacting(
        [FROM_KERNEL('IntegrationEventPublisher'), REPOSITORY_PORT],
        ['InvoiceRepository', 'IntegrationEventPublisher'],
      ),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'a before-commit handler given the cache of the kernel',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({ ...DECLARED_CONTEXT, [EVENT_HANDLER]: reacting([FROM_KERNEL('Cache')], ['Cache']) }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'a before-commit handler given the purger of the shared caches, which purges before the commit',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [EVENT_HANDLER]: reacting([FROM_KERNEL('CachePurger')], ['CachePurger']),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'a before-commit handler asking for a purge after the commit',
    expect: 'pass',
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [EVENT_HANDLER]: reacting([FROM_KERNEL('CacheInvalidation')], ['CacheInvalidation']),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'a before-commit handler given a port whose adapter is under infrastructure/external',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({ ...DECLARED_CONTEXT, [EVENT_HANDLER]: reacting([PAYMENT_PORT], ['PaymentGateway']) }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'the same port once its only adapter is under infrastructure/persistence',
    expect: 'pass',
    files: declaredProject({
      ...withoutFile(DECLARED_CONTEXT, PAYMENT_ADAPTER),
      [STORED_PAYMENTS]: STORED_ADAPTER,
      [EVENT_HANDLER]: reacting([PAYMENT_PORT], ['PaymentGateway']),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'the cache and the external port given to a handler declared after-commit',
    expect: 'pass',
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [EVENT_HANDLER]: reacting([FROM_KERNEL('Cache'), PAYMENT_PORT], ['Cache', 'PaymentGateway'], AFTER_COMMIT),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'an after-commit handler given the outbox publisher',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [EVENT_HANDLER]: reacting(
        [FROM_KERNEL('IntegrationEventPublisher')],
        ['IntegrationEventPublisher'],
        AFTER_COMMIT,
      ),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'explicit style: a handler clearing a cache, registered after-commit by the module file',
    expect: 'pass',
    files: project({
      [EVENT]: DECLARED.event,
      [EVENT_HANDLER]: PLAIN_EVENT_HANDLER,
      [EVENT_HANDLER_SPEC]: SAMPLES.SPEC,
      [MODULE]: moduleRegistering(`, { ${AFTER_COMMIT} }`),
    }),
  },
  {
    ruleId: TRANSACTIONAL,
    name: 'explicit style: the same handler registered without a phase',
    expect: { file: EVENT_HANDLER },
    files: project({
      [EVENT]: DECLARED.event,
      [EVENT_HANDLER]: PLAIN_EVENT_HANDLER,
      [EVENT_HANDLER_SPEC]: SAMPLES.SPEC,
      [MODULE]: moduleRegistering(''),
    }),
  },
];

export const DOMAIN_EVENTS_FIXTURES: readonly Fixture[] = [...DISPATCHED_ON_SAVE, ...TRANSACTIONAL_BEFORE_COMMIT];

/** The declared invoice-issued handler given the dependencies named, with the options its decorator adds to the name. */
function reacting(imports: readonly string[], dependencies: readonly string[], options?: string): string {
  return source(
    ...imports,
    `import { DomainEventHandler } from ${DECLARATIONS};`,
    "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';",
    '',
    `@DomainEventHandler(InvoiceIssued, { ${["name: 'billing.invoice.issued'", ...(options === undefined ? [] : [options])].join(', ')} }, [${dependencies.join(', ')}])`,
    'export class InvoiceIssuedEventHandler {}',
  );
}

/** The module file of the explicit style, wired by hand: the handler is built once and registered with the options given. */
function moduleRegistering(options: string): string {
  return source(
    "import { InvoiceIssuedEventHandler } from '@/contexts/billing/application/event-handlers/invoice-issued.event-handler.js';",
    "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';",
    '',
    'export function billingModule(platform: Platform): void {',
    "  const invoiceIssuedEventHandler = platform.adapter(new InvoiceIssuedEventHandler(platform.cache), { kind: 'domain-event-handler', context: 'billing' });",
    '',
    '  platform.domainEvents.on(',
    "    'billing.invoice.issued',",
    '    async (event) => {',
    '      if (event instanceof InvoiceIssued) {',
    '        await invoiceIssuedEventHandler.handle(event);',
    '      }',
    '    }' + options + ',',
    '  );',
    '}',
  );
}

/** The issue-invoice handler given the dependencies listed, its `execute` holding the statements given. */
function handlerDoing(dependencies: readonly string[], statements: readonly string[]): string {
  return source(
    `import { ${['Clock', ...dependencies].join(', ')} } from ${KERNEL};`,
    `import { CommandHandler } from ${DECLARATIONS};`,
    "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
    "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
    '',
    `@CommandHandler(IssueInvoiceCommand, [${['InvoiceRepository', 'Clock', ...dependencies].join(', ')}])`,
    'export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {',
    '  async execute(command: IssueInvoiceCommand): Promise<void> {',
    ...statements.map((statement) => `    ${statement}`),
    '  }',
    '}',
  );
}
