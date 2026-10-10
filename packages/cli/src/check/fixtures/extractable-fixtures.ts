import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { ADAPTER, BILLING, COMMAND, GATEWAY, HANDLER, INTEGRATION_HANDLER, INTEGRATION_HANDLER_SPEC, MODULE, REPOSITORY_PORT } = PATHS;
const { SPEC } = SAMPLES;

export const EXTRACTABLE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'context/extractable',
    name: 'a context wired alone, its own schema, a gateway on the published language, an entry point',
    expect: 'pass',
    files: project(
      {
        [MODULE]: "import type { ProductListedV1 } from '../catalog/published-language/index.js';\nimport { InMemoryInvoiceRepository } from './infrastructure/persistence/in-memory-invoice.repository.js';\n\nexport const billingModule = new InMemoryInvoiceRepository();\n\nexport type Listed = ProductListedV1;\n",
        [ADAPTER]: "export const billing = pgSchema('billing');\nexport class InMemoryInvoiceRepository {\n  private readonly rows = new Map<string, string>();\n\n  get size(): number {\n    return this.rows.size;\n  }\n}\n",
        [`${BILLING}/infrastructure/external/in-process-product.gateway.ts`]: "import type { ProductListedV1 } from '../../../catalog/published-language/index.js';\n\nexport type InProcessProductGateway = ProductListedV1;\n",
        'src/apps/billing/main.ts': "import { billingModule } from '../../contexts/billing/billing.module.js';\n\nbillingModule.start();\n",
      },
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }], deployable: true },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'context/extractable',
    name: 'a module that wires another context',
    expect: { file: MODULE },
    also: ['context/published-language-only'],
    files: project({ [MODULE]: "import { catalogModule } from '../catalog/catalog.module.js';\nexport const billingModule = [catalogModule];\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a repository importing the tables of another context',
    expect: { file: ADAPTER },
    also: ['context/published-language-only'],
    files: project({ [ADAPTER]: "import { products } from '../../../catalog/infrastructure/persistence/product.schema.js';\n\nexport const inMemoryInvoiceRepository = products;\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a repository naming the schema of another context',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: "export const inMemoryInvoiceRepository = pgSchema('catalog').table('products', {});\n" }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a handler loading through the repository of another context',
    expect: { file: HANDLER },
    also: ['context/published-language-only'],
    files: project(handler("import type { ProductRepository } from '../../../../catalog/domain/repositories/product.repository.js';\nexport class IssueInvoiceHandler {\n  constructor(private readonly products: ProductRepository) {}\n}\n")),
  },
  {
    ruleId: 'context/extractable',
    name: 'mutable state exported by a module',
    expect: { file: ADAPTER },
    files: project({ [ADAPTER]: 'export const inMemoryInvoiceRepository = new Map<string, string>();\n\nexport let lastInvoiceNumber = 0;\n' }),
  },
  {
    ruleId: 'context/extractable',
    name: 'a deployable context without its entry point',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'], deployable: true },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'context/extractable',
    name: 'declared style: ports of the context, the kernel, the auth package and the platform, and the published language of an upstream',
    expect: 'pass',
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [COMMAND]: DECLARED.command,
      ...handler(DECLARED.handler.replace("import { Clock }", "import { Access } from '@ddd-ts-kit/auth';\nimport { Clock }").replace('[InvoiceRepository, Clock]', '[InvoiceRepository, Access, Clock]')),
      [ADAPTER]: DECLARED.repository,
      [INTEGRATION_HANDLER]: DECLARED.integrationHandler,
      [INTEGRATION_HANDLER_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'context/extractable',
    name: 'declared style: a handler naming a port of another context',
    expect: { file: HANDLER },
    also: ['context/published-language-only'],
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(DECLARED.handler.replace("'../../../domain/repositories/invoice.repository.js'", "'../../../../catalog/application/ports/invoice.repository.port.js'")),
    }),
  },
  {
    ruleId: 'context/extractable',
    name: 'declared style: a gateway depending on a port of another context',
    expect: { file: GATEWAY },
    also: ['context/published-language-only'],
    files: declaredProject({ [GATEWAY]: DECLARED.gateway.replace("'../../../../platform/price-catalog-upstream.js'", "'../../../catalog/application/ports/price-catalog-upstream.port.js'") }),
  },
];
