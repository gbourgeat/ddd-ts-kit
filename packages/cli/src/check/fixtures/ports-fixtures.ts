import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { ADAPTER, COMMAND, HANDLER, MODULE, PAYMENT_ADAPTER, PORT, REPOSITORY_PORT } = PATHS;

const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";

const IMPORT_PORT = "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';";

const IMPLEMENTING = source(IMPORT_PORT, '', 'export class InMemoryInvoiceRepository implements InvoiceRepository {}');
const EXTENDING = source(IMPORT_PORT, '', 'export class InMemoryInvoiceRepository extends InvoiceRepository {}');

const ABSTRACT_CLASS: readonly Fixture[] = [
  {
    ruleId: 'ports/abstract-class',
    name: 'a repository port extending the kernel one, a port with abstract members, a token key and a data type beside it',
    expect: 'pass',
    files: project({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [PORT]: source(
        'export type Receipt = Readonly<{ id: string }>;',
        '',
        'export abstract class PaymentGateway {',
        "  static readonly tokenKey = 'billing.PaymentGateway';",
        '',
        '  abstract readonly currency: string;',
        '',
        '  abstract charge(invoiceId: string, options?: { retry: boolean }): Promise<Receipt>;',
        '}',
      ),
    }),
  },
  {
    ruleId: 'ports/abstract-class',
    name: 'a port declared as an interface',
    expect: { file: PORT },
    files: project({
      [PORT]: source('export interface PaymentGateway {', '  charge(invoiceId: string): Promise<void>;', '}'),
    }),
  },
  {
    ruleId: 'ports/abstract-class',
    name: 'a port with a constructor, a body, an initializer and a private member',
    expect: { file: PORT },
    files: project({
      [PORT]: source(
        'export abstract class PaymentGateway {',
        '  private readonly attempts = 3;',
        '  readonly currency: string;',
        '',
        '  constructor(currency: string) {',
        '    this.currency = currency;',
        '  }',
        '',
        '  charge(invoiceId: string): string {',
        '    return invoiceId + this.attempts;',
        '  }',
        '}',
      ),
    }),
  },
  {
    ruleId: 'ports/abstract-class',
    name: 'a concrete class in a repository port file',
    expect: { file: REPOSITORY_PORT },
    files: project({ [REPOSITORY_PORT]: 'export class InvoiceRepository {}\n' }),
  },
];

const IMPLEMENTS: readonly Fixture[] = [
  {
    ruleId: 'ports/implements-never-extends',
    name: 'declared adapters implementing their ports',
    expect: 'pass',
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [PORT]: DECLARED.port,
      [ADAPTER]: DECLARED.repository,
      [PAYMENT_ADAPTER]: DECLARED.adapter,
    }),
  },
  {
    ruleId: 'ports/implements-never-extends',
    name: 'explicit style: a class bound to the port it implements, and a class bound to itself',
    expect: 'pass',
    files: project({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [ADAPTER]: IMPLEMENTING,
      [MODULE]: moduleBinding(
        "builder.bind(InvoiceRepository).toClass(InMemoryInvoiceRepository, [Clock]).as('repository');",
        'builder.bind(InvoiceNumbering).toClass(InvoiceNumbering, []);',
      ),
    }),
  },
  {
    ruleId: 'ports/implements-never-extends',
    name: 'a declared repository that extends its port',
    expect: { file: ADAPTER },
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [ADAPTER]: DECLARED.repository.replace('implements InvoiceRepository', 'extends InvoiceRepository'),
    }),
  },
  {
    ruleId: 'ports/implements-never-extends',
    name: 'a declared adapter that does not implement its port',
    expect: { file: PAYMENT_ADAPTER },
    files: declaredProject({
      [PORT]: DECLARED.port,
      [PAYMENT_ADAPTER]: DECLARED.adapter.replace(' implements PaymentGateway', ''),
    }),
  },
  {
    ruleId: 'ports/implements-never-extends',
    name: 'explicit style: a module binding a port to a class that extends it, read in the file of the class',
    expect: { file: MODULE },
    files: project({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [ADAPTER]: EXTENDING,
      [MODULE]: moduleBinding('builder.rebind(InvoiceRepository).toClass(InMemoryInvoiceRepository, [Clock]);'),
    }),
  },
  {
    ruleId: 'ports/implements-never-extends',
    name: 'a class of infrastructure extending a class of a port file',
    expect: { file: ADAPTER },
    files: project({ [REPOSITORY_PORT]: DECLARED.repositoryPort, [ADAPTER]: EXTENDING }),
  },
];

const TOKEN_CONSTANT: readonly Fixture[] = [
  {
    ruleId: 'ports/no-token-constant',
    name: 'ports named by their class, and resolve of a path or a promise next to a module',
    expect: 'pass',
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [COMMAND]: DECLARED.command,
      ...handler(DECLARED.handler),
      'src/platform/platform-paths.ts': source(
        "import path from 'node:path';",
        "import { defineModule } from '@ddd-ts-kit/di';",
        '',
        "export const root = path.resolve('data');",
        "export const ready = Promise.resolve('ready');",
        "export const platformPaths = defineModule('paths', () => undefined);",
      ),
    }),
  },
  {
    ruleId: 'ports/no-token-constant',
    name: 'a token declared with token()',
    expect: { file: PORT },
    files: project({
      [PORT]: source(
        "import { token } from '@ddd-ts-kit/kernel';",
        '',
        "export const PAYMENT_GATEWAY = token<PaymentGateway>('billing.PaymentGateway');",
      ),
    }),
  },
  {
    ruleId: 'ports/no-token-constant',
    name: 'UPPER_SNAKE_CASE names in a dependency list',
    expect: { file: HANDLER },
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(handlerNaming([], '[INVOICE_REPOSITORY, CLOCK]')),
    }),
  },
  {
    ruleId: 'ports/no-token-constant',
    name: 'a symbol and a string given to bind',
    expect: { file: MODULE },
    files: project({
      [MODULE]: source(
        "import { defineModule } from '@ddd-ts-kit/di';",
        '',
        "const paymentGateway = Symbol.for('billing.PaymentGateway');",
        '',
        "export const billingModule = defineModule('billing', (builder) => {",
        '  builder.bind(paymentGateway).toValue(gateway);',
        "  builder.bind('billing.currency').toValue('EUR');",
        '});',
      ),
    }),
  },
  {
    ruleId: 'ports/no-token-constant',
    name: 'a file of tokens',
    expect: { file: 'src/platform/tokens.ts' },
    files: project({ 'src/platform/tokens.ts': 'export const tokens = {};\n' }),
  },
];

const CONCRETE_DEPENDENCY: readonly Fixture[] = [
  {
    ruleId: 'ports/no-concrete-dependency',
    name: 'lists naming ports, in a declaration and in a module',
    expect: 'pass',
    files: project({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [COMMAND]: DECLARED.command,
      ...handler(DECLARED.handler),
      [ADAPTER]: IMPLEMENTING,
      [MODULE]: moduleBinding(
        'builder.bind(InvoiceRepository).toClass(InMemoryInvoiceRepository, [Clock]);',
        "builder.command(IssueInvoiceCommand).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler, [InvoiceRepository, Clock]);",
      ),
    }),
  },
  {
    ruleId: 'ports/no-concrete-dependency',
    name: 'a handler naming the adapter instead of its port',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        handlerNaming(
          [
            "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';",
          ],
          '[InMemoryInvoiceRepository]',
        ),
      ),
    }),
  },
  {
    ruleId: 'ports/no-concrete-dependency',
    name: 'a module giving a handler the fake of a port',
    expect: { file: MODULE },
    files: project({
      [MODULE]: source(
        "import { defineModule } from '@ddd-ts-kit/di';",
        "import { FakeInvoiceRepository } from '@/contexts/billing/test/fakes/fake-invoice.repository.js';",
        '',
        "export const billingModule = defineModule('billing', (builder) => {",
        "  builder.command(IssueInvoiceCommand).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler, [FakeInvoiceRepository]);",
        '});',
      ),
    }),
  },
];

const VALUE_IMPORT: readonly Fixture[] = [
  {
    ruleId: 'ports/value-import',
    name: 'ports imported as values, a class that only types a parameter imported as a type',
    expect: 'pass',
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        DECLARED.handler
          .replace(
            "import { Clock } from '@ddd-ts-kit/kernel';",
            "import { Clock, type Logger } from '@ddd-ts-kit/kernel';",
          )
          .replace('{}', '{\n  constructor(private readonly logger: Logger) {}\n}'),
      ),
    }),
  },
  {
    ruleId: 'ports/value-import',
    name: 'a port imported with import type and named in a dependency list',
    expect: { file: HANDLER },
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        handlerNaming(
          ["import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';"],
          '[InvoiceRepository]',
        ),
      ),
    }),
  },
  {
    ruleId: 'ports/value-import',
    name: 'a port imported with an inline type and given to bind',
    expect: { file: MODULE },
    files: project(
      {
        [MODULE]: source(
          "import { defineModule } from '@ddd-ts-kit/di';",
          "import { type Clock } from '@ddd-ts-kit/kernel';",
          '',
          "export const billingModule = defineModule('billing', (builder) => {",
          '  builder.bind(Clock).toValue(clock);',
          '});',
        ),
      },
      { [CONFIG_FILE]: config() },
    ),
  },
];

export const PORTS_FIXTURES: readonly Fixture[] = [
  ...ABSTRACT_CLASS,
  ...IMPLEMENTS,
  ...TOKEN_CONSTANT,
  ...CONCRETE_DEPENDENCY,
  ...VALUE_IMPORT,
];

function moduleBinding(...statements: string[]): string {
  return source(
    "import { defineModule } from '@ddd-ts-kit/di';",
    "import { Clock } from '@ddd-ts-kit/kernel';",
    "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
    "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';",
    '',
    "export const billingModule = defineModule('billing', (builder) => {",
    ...statements.map((statement) => `  ${statement}`),
    '});',
  );
}

function handlerNaming(imports: readonly string[], list: string): string {
  return source(
    `import { CommandHandler } from ${DECLARATIONS};`,
    ...imports,
    "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
    '',
    `@CommandHandler(IssueInvoiceCommand, ${list})`,
    'export class IssueInvoiceHandler {}',
  );
}
