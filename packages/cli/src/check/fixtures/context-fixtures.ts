import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { declaration } from './declaration';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { ADAPTER, BILLING, CATALOG, PUBLISHED, ROUTE } = PATHS;
const { DECLARE } = SAMPLES;

export const CONTEXT_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through its published language',
    expect: 'pass',
    files: project({
      [ADAPTER]: "export * from '@/contexts/catalog/published-language/index.js';\n",
    }),
  },
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through its domain',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        "import { Product } from '@/contexts/catalog/domain/aggregates/product.aggregate.js';\n\nexport const inMemoryInvoiceRepository = Product;\n",
    }),
  },
  {
    ruleId: 'context/published-language-only',
    name: 'another context imported through the alias',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]:
        "import type { SearchProductsHandler } from '@/contexts/catalog/application/queries/search-products/search-products.handler.js';\n\nexport type IssueInvoiceRoute = SearchProductsHandler;\n",
    }),
  },
  {
    ruleId: 'context/declared-relationship',
    name: 'an upstream that is declared',
    expect: 'pass',
    files: project({
      [ROUTE]:
        "import type { ProductListedV1 } from '@/contexts/catalog/published-language/index.js';\n\nexport type IssueInvoiceRoute = ProductListedV1;\n",
    }),
  },
  {
    ruleId: 'context/declared-relationship',
    name: 'a published language imported without a declared relationship',
    expect: { file: `${CATALOG}/presentation/http/search-products.route.ts` },
    files: project({
      [`${CATALOG}/presentation/http/search-products.route.ts`]:
        "import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index.js';\n\nexport type SearchProductsRoute = InvoiceIssuedV1;\n",
    }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a declaration built on the kernel envelope and the schema library of the project',
    expect: 'pass',
    files: project({
      [PUBLISHED]: `import type { IntegrationEvent } from '@ddd-ts-kit/kernel';\n${DECLARE}${declaration('billing.invoice.issued')}export type InvoiceIssuedV1 = IntegrationEvent<{ readonly invoiceId: string }>;\n`,
      [`${BILLING}/published-language/index.ts`]:
        "export * from '@/contexts/billing/published-language/invoice-issued.v1.integration-event.js';\n",
    }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a contract importing a package that is neither the kernel nor the schema library',
    expect: { file: PUBLISHED },
    files: project({ [PUBLISHED]: "import { v4 } from 'uuid';\n\nexport const invoiceIssuedV1 = v4();\n" }),
  },
  {
    ruleId: 'context/published-language-is-a-contract',
    name: 'a contract re-exporting the domain',
    expect: { file: `${BILLING}/published-language/index.ts` },
    files: project({
      [`${BILLING}/published-language/index.ts`]:
        "export { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';\n",
    }),
  },
  {
    ruleId: 'context/no-cycle',
    name: 'a one-way relationship',
    expect: 'pass',
    files: project({}),
  },
  {
    ruleId: 'context/no-cycle',
    name: 'two contexts upstream of each other',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'catalog' }] },
            catalog: { classification: 'supporting', upstreams: ['billing'] },
          },
        }),
      },
    ),
  },
];
