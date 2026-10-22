import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { SIGNATURE } from './signature';
import { signatureProject } from './signature-project';
import { source } from './source';

const { BILLING, COMMANDS_DECLARATIONS, HANDLER } = PATHS;
const RULE = 'declarations/constructor-injection';
const BARE = '@CommandHandler(IssueInvoiceCommand)';
const SETTINGS = `${BILLING}/application/ports/invoice-settings.port.ts`;
const DEPENDENCIES = `${BILLING}/billing.dependencies.ts`;

const takingInstead = (parameter: string, imports: readonly string[] = SIGNATURE.ports): string =>
  SIGNATURE.handlerOf(BARE, imports, [SIGNATURE.taken[0] ?? '', parameter]);

const REFUSED_PARAMETERS: readonly (readonly [string, string])[] = [
  ['a union of two classes', 'private readonly clock: Clock | InvoiceRepository'],
  ['an optional parameter', 'private readonly clock?: Clock'],
  ['a default value', 'private readonly clock: Clock = fallbackClock'],
  ['a type of the language', 'private readonly retries: number'],
  ['a rest parameter', '...clocks: Clock[]'],
  ['a destructured parameter', '{ now }: Clock'],
];

export const CONSTRUCTOR_INJECTION_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a handler that lists nothing and types each constructor parameter by a port, its barrel registering what was read',
    expect: 'pass',
    files: signatureProject(SIGNATURE.handler, { [COMMANDS_DECLARATIONS]: SIGNATURE.declarations }),
  },
  {
    ruleId: RULE,
    name: 'a parameter typed by a generic class, whose raw class is the token',
    expect: 'pass',
    files: signatureProject(takingInstead('private readonly clock: Clock<Date>'), {
      [COMMANDS_DECLARATIONS]: SIGNATURE.declarations,
    }),
  },
  ...REFUSED_PARAMETERS.map(
    ([name, parameter]): Fixture => ({
      ruleId: RULE,
      name: `a constructor parameter that names no single class: ${name}`,
      expect: { file: HANDLER },
      files: signatureProject(takingInstead(parameter)),
    }),
  ),
  {
    ruleId: RULE,
    name: 'a parameter typed by an interface the file declares',
    expect: { file: HANDLER },
    files: signatureProject(
      `${takingInstead('private readonly settings: InvoiceSettings')}\ninterface InvoiceSettings {\n  readonly currency: string;\n}\n`,
    ),
  },
  {
    ruleId: RULE,
    name: 'a parameter typed by an interface of another file of the project',
    expect: { file: HANDLER },
    also: ['ports/abstract-class'],
    files: signatureProject(
      takingInstead('private readonly settings: InvoiceSettings', [
        ...SIGNATURE.ports,
        "import type { InvoiceSettings } from '@/contexts/billing/application/ports/invoice-settings.port.js';",
      ]),
      { [SETTINGS]: source('export interface InvoiceSettings {', '  readonly currency: string;', '}') },
    ),
  },
  {
    ruleId: RULE,
    name: 'a class that inherits its constructor from a class of a package',
    expect: { file: HANDLER },
    files: signatureProject(
      source(
        "import { RecordedHandler } from '@ddd-ts-kit/kernel';",
        "import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';",
        "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
        '',
        BARE,
        'export class IssueInvoiceHandler extends RecordedHandler {}',
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a signature project whose decorator repeats what the constructor states',
    expect: { file: HANDLER },
    files: signatureProject(
      SIGNATURE.handlerOf(
        '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])',
        SIGNATURE.ports.map((line) => line.replace('import type', 'import')),
        SIGNATURE.taken,
      ),
    ),
  },
  {
    ruleId: RULE,
    name: 'a signature project whose decorator lists another class than the constructor is typed by',
    expect: { file: HANDLER },
    files: signatureProject(
      SIGNATURE.handlerOf(
        '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, IdGenerator])',
        [
          "import { IdGenerator, type Clock } from '@ddd-ts-kit/kernel';",
          (SIGNATURE.ports[1] ?? '').replace('import type', 'import'),
        ],
        SIGNATURE.taken,
      ),
    ),
  },
  {
    ruleId: 'ports/no-concrete-dependency',
    name: 'a constructor parameter typed by the adapter instead of its port',
    expect: { file: HANDLER },
    also: ['layer/application-inward', 'declarations/barrel-current'],
    files: signatureProject(
      SIGNATURE.handlerOf(
        BARE,
        [
          "import type { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';",
        ],
        ['private readonly invoiceRepository: InMemoryInvoiceRepository'],
      ),
    ),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'declarations whose dependency list was read from a constructor that has changed since',
    expect: { file: COMMANDS_DECLARATIONS },
    files: signatureProject(SIGNATURE.handler, {
      [COMMANDS_DECLARATIONS]: SIGNATURE.declarations.replace('[InvoiceRepository, Clock]', '[InvoiceRepository]'),
    }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'declarations that register no dependency list for a constructor that takes something',
    expect: { file: COMMANDS_DECLARATIONS },
    files: signatureProject(SIGNATURE.handler),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'assembly by discovery: the dependencies file registers what each constructor takes',
    expect: 'pass',
    files: signatureProject(SIGNATURE.handler, { [DEPENDENCIES]: SIGNATURE.dependencies }, 'discovery'),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'assembly by discovery: a constructor takes something and no dependencies file registers it',
    expect: { file: DEPENDENCIES },
    files: signatureProject(SIGNATURE.handler, {}, 'discovery'),
  },
];
