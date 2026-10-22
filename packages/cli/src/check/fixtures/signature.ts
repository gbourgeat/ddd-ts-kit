import { source } from './source';

const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";
const COMMAND = "'@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js'";
const HANDLER = "'@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js'";
const REPOSITORY = "'@/contexts/billing/domain/repositories/invoice.repository.js'";

const PORTS = [
  "import type { Clock } from '@ddd-ts-kit/kernel';",
  `import type { InvoiceRepository } from ${REPOSITORY};`,
];

const TAKEN = ['private readonly invoiceRepository: InvoiceRepository', 'private readonly clock: Clock'];

/** A handler whose constructor states its dependencies, and what the generated files of its context then hold. */
export const SIGNATURE = {
  handler: handler('@CommandHandler(IssueInvoiceCommand)', PORTS, TAKEN),
  handlerOf: handler,
  ports: PORTS,
  taken: TAKEN,
  /** The declarations of application/commands/, which the handler and its command sit in. */
  declarations: source(
    `import { injected } from ${DECLARATIONS};`,
    `import { IssueInvoiceHandler } from ${HANDLER};`,
    `import { InvoiceRepository } from ${REPOSITORY};`,
    "import { Clock } from '@ddd-ts-kit/kernel';",
    '',
    `export * from ${COMMAND};`,
    `export * from ${HANDLER};`,
    '',
    'injected(IssueInvoiceHandler, [InvoiceRepository, Clock]);',
  ),
  dependencies: source(
    `import { injected } from ${DECLARATIONS};`,
    `import { IssueInvoiceHandler } from ${HANDLER};`,
    `import { InvoiceRepository } from ${REPOSITORY};`,
    "import { Clock } from '@ddd-ts-kit/kernel';",
    '',
    'injected(IssueInvoiceHandler, [InvoiceRepository, Clock]);',
  ),
} as const;

/** The issue-invoice handler, declared with `decorator`, importing `imports` and taking `parameters`. */
function handler(decorator: string, imports: readonly string[], parameters: readonly string[]): string {
  return source(
    ...imports,
    `import { CommandHandler } from ${DECLARATIONS};`,
    `import { IssueInvoiceCommand } from ${COMMAND};`,
    '',
    decorator,
    'export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {',
    '  constructor(',
    ...parameters.map((parameter) => `    ${parameter},`),
    '  ) {}',
    '}',
  );
}
