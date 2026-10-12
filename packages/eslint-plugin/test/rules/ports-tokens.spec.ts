import { portsNoConcreteDependency } from '../../src/rules/ports-no-concrete-dependency.js';
import { portsNoTokenConstant } from '../../src/rules/ports-no-token-constant.js';
import { portsValueImport } from '../../src/rules/ports-value-import.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const DECLARATIONS = '@ddd-ts-kit/kernel/declarations';
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;
const DI = "import type { ModuleBuilder } from '@ddd-ts-kit/di';\n";

const handler = (imports: string, list: string): string =>
  `import { CommandHandler } from '${DECLARATIONS}';\n${imports}\n@CommandHandler(IssueInvoiceCommand, [${list}])\nexport class IssueInvoiceHandler {}`;

ruleTester.run('ports-no-token-constant', portsNoTokenConstant, {
  valid: [
    at(HANDLER, handler("import { Clock } from '@ddd-ts-kit/kernel';", 'InvoiceRepository, Clock')),
    at(
      MODULE,
      `${DI}builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database, Clock]);\nbuilder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [InvoiceRepository]);`,
    ),
    at(
      MODULE,
      `${DI}const value = await Promise.resolve('x');\nconst file = path.resolve('x');\nconst entry = require.resolve('x');\nconst url = import.meta.resolve('x');`,
    ),
    at('src/platform/files.ts', "const file = resolve('x');\nlocator.bind('x');\nconst key = Symbol('key');"),
    at('src/platform/lexer.ts', "import { token } from './lexer-tokens.js';\ntoken('x');"),
    at('src/platform/retry.ts', 'const MAX_ATTEMPTS = 3;\nretry([MAX_ATTEMPTS]);'),
    at(
      SPEC,
      "import { fake } from '@ddd-ts-kit/di';\nfake(Clock, { now: () => new Date(0) });\napp.resolve(CommandBus);",
    ),
    at('scripts/tokens.ts', 'export const a = 1;'),
    at('src/platform/design-tokens.ts', 'export const a = 1;'),
  ],
  invalid: [
    {
      ...at(HANDLER, handler('', 'INVOICE_REPOSITORY, CLOCK, Clock')),
      errors: [
        { messageId: 'constant', data: { name: 'INVOICE_REPOSITORY' } },
        { messageId: 'constant', data: { name: 'CLOCK' } },
      ],
    },
    {
      ...at(
        MODULE,
        `${DI}builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [DATABASE]);\nbuilder.command(C).handledBy(H, [INVOICE_REPOSITORY]);`,
      ),
      errors: [{ messageId: 'constant' }, { messageId: 'constant' }],
    },
    {
      ...at(
        'src/platform/tokens.ts',
        "import { token } from '@ddd-ts-kit/kernel/declarations';\nexport const CLOCK = token<Clock>('clock');",
      ),
      errors: [
        { messageId: 'tokenFile', line: 1, data: { file: 'tokens.ts' } },
        { messageId: 'tokenCall', data: { call: 'token' } },
      ],
    },
    {
      ...at(`${BILLING}/application/ports/billing.ports.ts`, 'export abstract class PaymentGateway {}'),
      errors: [{ messageId: 'tokenFile', data: { file: 'billing.ports.ts' } }],
    },
    {
      ...at('src/platform/clock.ts', "import * as di from '@ddd-ts-kit/di';\nconst CLOCK = di.token('clock');"),
      errors: [{ messageId: 'tokenCall', data: { call: 'di.token' } }],
    },
    {
      ...at('src/platform/clock.ts', "import { token as make } from '@ddd-ts-kit/di';\nconst clock = make('clock');"),
      errors: [{ messageId: 'tokenCall' }],
    },
    {
      ...at(
        MODULE,
        `${DI}builder.bind('clock').toValue(clock);\nbuilder.bind(Symbol('clock')).toValue(clock);\nrebind(Symbol.for('clock')).toValue(clock);`,
      ),
      errors: [
        { messageId: 'literalToken', data: { call: 'bind', what: 'a string' } },
        { messageId: 'literalToken', data: { call: 'bind', what: 'a symbol' } },
        { messageId: 'literalToken', data: { call: 'rebind', what: 'a symbol' } },
      ],
    },
    {
      ...at(
        MODULE,
        `${DI}const clockToken = Symbol('clock');\nbuilder.bind(clockToken).toValue(clock);\napp.resolve(clockToken);`,
      ),
      errors: [{ messageId: 'madeToken', data: { name: 'clockToken' } }, { messageId: 'madeToken' }],
    },
    {
      ...at(SPEC, "import { fake, override } from '@ddd-ts-kit/di';\nfake('clock', {});\noverride('clock', {});"),
      errors: [
        { messageId: 'literalToken', data: { call: 'fake', what: 'a string' } },
        { messageId: 'literalToken', data: { call: 'override', what: 'a string' } },
      ],
    },
  ],
});

const DECLARED_STYLE = {
  contexts: { billing: { classification: 'core', upstreams: [] } },
  stack: { style: 'declared', dependencies: 'signature' },
};

const taking = (imports: string, parameters: string, decorator = '@CommandHandler(IssueInvoiceCommand)'): string =>
  `import { CommandHandler } from '${DECLARATIONS}';\n${imports}\n${decorator}\nexport class IssueInvoiceHandler {\n  constructor(${parameters}) {}\n}`;

const KNEX =
  "import type { KnexInvoiceRepository } from '../../../infrastructure/persistence/knex-invoice.repository.js';";

const FAKE = "import type { FakeInvoiceRepository } from '../../../test/fakes/invoice.repository.fake.js';";

ruleTester.run(
  'ports-no-concrete-dependency, on a constructor that states the dependencies',
  portsNoConcreteDependency,
  {
    valid: [
      at(
        HANDLER,
        taking(
          "import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';",
          'private readonly invoices: InvoiceRepository, private readonly clock: Clock, raw: string | number',
        ),
        DECLARED_STYLE,
      ),
      // Outside the declared style a class is bound in the module file, whose list is judged.
      at(HANDLER, taking(KNEX, 'private readonly invoices: KnexInvoiceRepository')),
      at(SPEC, taking(FAKE, 'private readonly invoices: FakeInvoiceRepository'), DECLARED_STYLE),
      at(
        `${BILLING}/infrastructure/persistence/invoice.mapper.ts`,
        taking(KNEX, 'a: KnexInvoiceRepository'),
        DECLARED_STYLE,
      ),
    ],
    invalid: [
      {
        ...at(
          HANDLER,
          taking(`${KNEX}\n${FAKE}`, 'private readonly invoices: KnexInvoiceRepository, fake: FakeInvoiceRepository'),
          DECLARED_STYLE,
        ),
        errors: [
          { messageId: 'typed', data: { name: 'KnexInvoiceRepository', where: 'infrastructure/' } },
          { messageId: 'typed', data: { name: 'FakeInvoiceRepository', where: 'test/fakes/' } },
        ],
      },
      {
        // With a list, the list is what is injected: it is the one judged.
        ...at(
          HANDLER,
          taking(
            KNEX.replace('import type', 'import'),
            'private readonly invoices: KnexInvoiceRepository',
            '@CommandHandler(IssueInvoiceCommand, [KnexInvoiceRepository])',
          ),
          DECLARED_STYLE,
        ),
        errors: [{ messageId: 'concrete', data: { name: 'KnexInvoiceRepository', where: 'infrastructure/' } }],
      },
    ],
  },
);

ruleTester.run('ports-no-concrete-dependency', portsNoConcreteDependency, {
  valid: [
    at(
      HANDLER,
      handler(
        "import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';\nimport { PaymentGateway } from '../../ports/payment-gateway.port.js';",
        'InvoiceRepository, PaymentGateway',
      ),
    ),
    at(
      MODULE,
      "import { KnexInvoiceRepository } from './infrastructure/persistence/knex-invoice.repository.js';\nbuilder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database]);",
    ),
    at(
      HANDLER,
      handler(
        "import { Clock } from '@ddd-ts-kit/kernel';\nimport { Money } from '@/shared-kernel/money.vo.js';",
        'Clock, Money, Unknown',
      ),
    ),
  ],
  invalid: [
    {
      ...at(
        HANDLER,
        handler(
          "import { KnexInvoiceRepository } from '../../../infrastructure/persistence/knex-invoice.repository.js';",
          'KnexInvoiceRepository, Clock',
        ),
      ),
      errors: [{ messageId: 'concrete', data: { name: 'KnexInvoiceRepository', where: 'infrastructure/' } }],
    },
    {
      ...at(
        HANDLER,
        handler(
          "import { InMemoryInvoiceRepository } from '../../../test/fakes/in-memory-invoice.repository.js';",
          'InMemoryInvoiceRepository',
        ),
      ),
      errors: [{ messageId: 'concrete', data: { name: 'InMemoryInvoiceRepository', where: 'test/fakes/' } }],
    },
    {
      ...at(
        MODULE,
        "import { KnexDatabase } from './infrastructure/persistence/knex-database.js';\nimport { StripeGateway as Stripe } from '@/contexts/billing/infrastructure/external/stripe.gateway.js';\nbuilder.bind(A).toClass(B, [KnexDatabase]);\nbuilder.command(C).handledBy(H, [Stripe]);",
      ),
      errors: [
        { messageId: 'concrete', data: { name: 'KnexDatabase', where: 'infrastructure/' } },
        { messageId: 'concrete', data: { name: 'Stripe', where: 'infrastructure/' } },
      ],
    },
  ],
});

ruleTester.run('ports-value-import', portsValueImport, {
  valid: [
    at(
      HANDLER,
      handler(
        "import { Clock } from '@ddd-ts-kit/kernel';\nimport type { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';",
        'Clock',
      ),
    ),
    at(MODULE, `${DI}import { Clock } from '@ddd-ts-kit/kernel';\nbuilder.bind(Clock).toValue(clock);`),
    at('src/platform/files.ts', "import type { Clock } from '@ddd-ts-kit/kernel';\nlocator.bind(Clock);"),
    at(MODULE, `${DI}import type { Clock } from '@ddd-ts-kit/kernel';\napp.resolve(Clock);`),
  ],
  invalid: [
    {
      ...at(HANDLER, handler("import type { Clock } from '@ddd-ts-kit/kernel';", 'Clock')),
      output: handler("import { Clock } from '@ddd-ts-kit/kernel';", 'Clock'),
      errors: [{ messageId: 'typeImport', data: { name: 'Clock' } }],
    },
    {
      ...at(HANDLER, handler("import { type Clock, IdGenerator } from '@ddd-ts-kit/kernel';", 'Clock, IdGenerator')),
      output: handler("import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';", 'Clock, IdGenerator'),
      errors: [{ messageId: 'typeImport' }],
    },
    {
      ...at(HANDLER, handler("import type { Clock, Logger } from '@ddd-ts-kit/kernel';", 'Clock')),
      output: handler("import { Clock, type Logger } from '@ddd-ts-kit/kernel';", 'Clock'),
      errors: [{ messageId: 'typeImport' }],
    },
    {
      ...at(
        MODULE,
        `${DI}import type { Clock } from '@ddd-ts-kit/kernel';\nbuilder.bind(Clock).toValue(clock);\nbuilder.command(C).handledBy(H, [Clock]);`,
      ),
      output: `${DI}import { Clock } from '@ddd-ts-kit/kernel';\nbuilder.bind(Clock).toValue(clock);\nbuilder.command(C).handledBy(H, [Clock]);`,
      errors: [{ messageId: 'typeImport' }, { messageId: 'typeImport' }],
    },
  ],
});
