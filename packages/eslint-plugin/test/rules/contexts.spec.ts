import {
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  contextPublishedLanguageOnly,
} from '../../src/rules/context-boundaries';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const CONTRACT = `${BILLING}/published-language/invoice-issued.v1.integration-event.ts`;

ruleTester.run('context-published-language-only', contextPublishedLanguageOnly, {
  valid: [
    at(HANDLER, "import type { ProductListedV1 } from '../../../../catalog/published-language/index.js';"),
    at(HANDLER, "import type { ProductListedV1 } from '@/contexts/catalog/published-language';"),
    at(HANDLER, "import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';"),
    at('src/platform/application.ts', "import { catalogModule } from '@/contexts/catalog/catalog.module.js';"),
  ],
  invalid: [
    {
      ...at(HANDLER, "import { Product } from '../../../../catalog/domain/aggregates/product.aggregate.js';"),
      errors: [
        {
          messageId: 'internals',
          data: {
            here: 'billing',
            there: 'catalog',
            path: 'src/contexts/catalog/domain/aggregates/product.aggregate.ts',
            contextsDir: 'src/contexts',
          },
        },
      ],
    },
    {
      ...at(
        HANDLER,
        "import type { ProductReader } from '@/contexts/catalog/application/ports/product-reader.port.js';",
      ),
      errors: [{ messageId: 'internals' }],
    },
    {
      ...at(
        `${BILLING}/test/unit/invoice.spec.ts`,
        "import { aProduct } from '../../../catalog/test/builders/product.builder.js';",
      ),
      errors: [{ messageId: 'internals' }],
    },
    { ...at(HANDLER, "export * from '../../../../catalog/catalog.module.js';"), errors: [{ messageId: 'internals' }] },
    {
      ...at(
        HANDLER,
        "const catalog = await import('@/contexts/catalog/infrastructure/persistence/catalog.schema.js');",
      ),
      errors: [{ messageId: 'internals' }],
    },
  ],
});

ruleTester.run('context-declared-relationship', contextDeclaredRelationship, {
  valid: [
    at(HANDLER, "import type { ProductListedV1 } from '@/contexts/catalog/published-language/index.js';"),
    at(HANDLER, "import type { InvoiceIssuedV1 } from '../../../published-language/index.js';"),
    at(
      'src/contexts/shipping/shipping.module.ts',
      "import { x } from '@/contexts/billing/published-language/index.js';",
      { contexts: { shipping: { classification: 'supporting', upstreams: ['billing'] } } },
    ),
  ],
  invalid: [
    {
      ...at(
        'src/contexts/shipping/application/integration/handlers/billing-invoice-issued.integration-handler.ts',
        "import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index.js';",
      ),
      errors: [{ messageId: 'undeclared', data: { here: 'shipping', there: 'billing' } }],
    },
    {
      ...at('src/contexts/catalog/catalog.module.ts', "import('../billing/published-language/index.js');"),
      errors: [{ messageId: 'undeclared' }],
    },
    {
      ...at('src/contexts/unknown/domain/x.ts', "import type { A } from '../../billing/published-language/index.js';"),
      errors: [{ messageId: 'undeclared' }],
    },
  ],
});

ruleTester.run('context-published-language-is-a-contract', contextPublishedLanguageIsAContract, {
  valid: [
    at(
      CONTRACT,
      "import { defineIntegrationEvent } from '@ddd-ts-kit/events';\nimport { z } from 'zod';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';",
    ),
    at(CONTRACT, "import type { ProductListedV1 } from '../../catalog/published-language/index.js';"),
    at(`${BILLING}/published-language/index.ts`, "export * from './invoice-issued.v1.integration-event.js';"),
    at(CONTRACT, "import { IsString } from 'class-validator';", {
      ...SAMPLE_CONFIG,
      stack: { validation: 'class-validator' },
    }),
  ],
  invalid: [
    {
      ...at(CONTRACT, "import type { Invoice } from '../domain/aggregates/invoice.aggregate.js';"),
      errors: [{ messageId: 'leak', data: { target: 'billing/domain' } }],
    },
    { ...at(CONTRACT, "import { IsString } from 'class-validator';"), errors: [{ messageId: 'leak' }] },
    { ...at(CONTRACT, "import { randomUUID } from 'node:crypto';"), errors: [{ messageId: 'leak' }] },
    {
      ...at(CONTRACT, "export type { InvoiceState } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';"),
      errors: [{ messageId: 'leak' }],
    },
    { ...at(CONTRACT, "import { Money } from '@/shared-kernel/money.vo.js';"), errors: [{ messageId: 'leak' }] },
  ],
});
