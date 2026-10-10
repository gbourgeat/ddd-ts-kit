import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { ADAPTER, BILLING, HANDLER, PLATFORM_MODULE } = PATHS;

export const COMPOSITION_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'composition/only-in-module',
    name: 'adapters created in the module file, main.ts and tests',
    expect: 'pass',
    files: project({
      [ADAPTER]: 'export class InMemoryInvoiceRepository {}\n',
      [`${BILLING}/billing.module.ts`]:
        "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\nexport const billingModule = new InMemoryInvoiceRepository();\n",
      'src/main.ts':
        "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\n\nconst repository = new InMemoryInvoiceRepository();\n\nrepository.start();\n",
      [`${BILLING}/test/integration/in-memory-invoice.repository.spec.ts`]:
        "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\nexport const repository = new InMemoryInvoiceRepository();\n",
    }),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'an adapter instantiated by a handler',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(
      handler(
        "import { InMemoryInvoiceRepository as Repo } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\nexport class IssueInvoiceHandler {\n  readonly repository = new Repo();\n}\n",
      ),
    ),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'an adapter bound to its port outside the module',
    expect: { file: 'src/bootstrap.ts' },
    files: project({
      'src/bootstrap.ts':
        "import { InMemoryInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/in-memory-invoice.repository.js';\n\nexport function bootstrap(builder: Builder): void {\n  builder.bind(InvoiceRepository).toClass(InMemoryInvoiceRepository, []);\n}\n",
    }),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'a declared adapter bound by its declaration, contexts assembled in main.ts, an entry point and the platform',
    expect: 'pass',
    files: declaredProject({
      [ADAPTER]: DECLARED.repository,
      'src/main.ts':
        "import { contextModule } from '@ddd-ts-kit/di';\nimport * as billingDeclarations from '@/contexts/billing/billing.declarations.js';\n\nconst billing = contextModule('billing', billingDeclarations);\n\nbilling.start();\n",
      'src/apps/billing/main.ts':
        "import { discoverContext } from '@ddd-ts-kit/di/discovery';\n\nconst billing = await discoverContext('billing', new URL('../../contexts/billing/', import.meta.url));\n\nbilling.start();\n",
      [PLATFORM_MODULE]:
        "import { defineModule } from '@ddd-ts-kit/di';\nexport const platformModule = defineModule('platform', (builder) => {\n  builder.include(platformAdapters);\n});\n",
    }),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'a context assembled outside the composition root',
    expect: { file: 'src/bootstrap.ts' },
    files: project({
      'src/bootstrap.ts':
        "import { contextModule } from '@ddd-ts-kit/di';\n\nexport const bootstrap = contextModule('billing', declared);\n",
    }),
  },
  {
    ruleId: 'composition/only-in-module',
    name: 'declared classes included in a module builder by an adapter',
    expect: { file: `${BILLING}/infrastructure/external/extend-billing.ts` },
    files: project({
      [`${BILLING}/infrastructure/external/extend-billing.ts`]:
        "import type { ModuleBuilder } from '@ddd-ts-kit/di';\n\nexport function extendBilling(builder: ModuleBuilder): void {\n  builder.include(declared);\n}\n",
    }),
  },
];
