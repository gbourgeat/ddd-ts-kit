import { DECLARED_CONTEXT } from './declared-context.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { source } from './source.js';

const { ADAPTER, AGGREGATE_SPEC, EVENT_HANDLER, HANDLER } = PATHS;
const RULE = 'domain-events/dispatched-on-save';
const KERNEL = "'@ddd-ts-kit/kernel'";
const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";

const SAVING_ADAPTER = source(
  `import { Repository } from ${DECLARATIONS};`,
  "import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';",
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
  "import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';",
  '',
  "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [DomainEventDispatcher])",
  'export class InvoiceIssuedEventHandler {',
  '  async handle(event: InvoiceIssued): Promise<void> {',
  '    await this.dispatcher.dispatch(event.invoice.pullEvents());',
  '  }',
  '}',
);

export const DOMAIN_EVENTS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a handler that saves and nothing else, events read in a spec and dispatched by the platform',
    expect: 'pass',
    files: declaredProject({
      ...DECLARED_CONTEXT,
      [HANDLER]: handlerDoing([], ['await this.invoices.save(command.invoice);']),
      [AGGREGATE_SPEC]: "import { expect, it } from 'vitest';\n\nit('records nothing twice', () => {\n  expect(invoice.pullEvents()).toEqual([]);\n});\n",
      'src/platform/dispatching-on-save.ts': `import { DomainEventDispatcher } from ${KERNEL};\n\nexport const dispatched = (dispatcher: DomainEventDispatcher, saved: Saved): Promise<void> => dispatcher.dispatch(saved.pullEvents());\n`,
    }),
  },
  {
    ruleId: RULE,
    name: 'a command handler pulling the events of the aggregate it saved',
    expect: { file: HANDLER },
    files: declaredProject({ ...DECLARED_CONTEXT, [HANDLER]: handlerDoing([], ['await this.invoices.save(command.invoice);', 'await this.announce(command.invoice.pullEvents());']) }),
  },
  {
    ruleId: RULE,
    name: 'a command handler given the dispatcher',
    expect: { file: HANDLER },
    files: declaredProject({ ...DECLARED_CONTEXT, [HANDLER]: handlerDoing(['DomainEventDispatcher'], ['await this.invoices.save(command.invoice);']) }),
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

/** The issue-invoice handler given the dependencies listed, its `execute` holding the statements given. */
function handlerDoing(dependencies: readonly string[], statements: readonly string[]): string {
  return source(
    `import { ${['Clock', ...dependencies].join(', ')} } from ${KERNEL};`,
    `import { CommandHandler } from ${DECLARATIONS};`,
    "import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';",
    "import { IssueInvoiceCommand } from './issue-invoice.command.js';",
    '',
    `@CommandHandler(IssueInvoiceCommand, [${['InvoiceRepository', 'Clock', ...dependencies].join(', ')}])`,
    'export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {',
    '  async execute(command: IssueInvoiceCommand): Promise<void> {',
    ...statements.map((statement) => `    ${statement}`),
    '  }',
    '}',
  );
}
