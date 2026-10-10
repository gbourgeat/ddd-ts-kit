import { contextExtractable } from '../../src/rules/context-extractable.js';
import { eventsConsumerIdempotent } from '../../src/rules/events-consumer-idempotent.js';
import {
  DECLARED,
  EXPLICIT,
  DECLARATIONS,
  declaring,
  MODULE,
  COMMAND,
  HANDLER,
  QUERY_HANDLER,
  INTEGRATION_HANDLER,
  PORT,
  REPOSITORY,
  GATEWAY,
  MAPPER,
  SPEC,
} from '../support/declared-style.js';
import { at, ruleTester } from '../support/rule-tester.js';

const REACTION = 'export class CatalogProductListedHandler { async handle(event: ProductListedV1): Promise<void> {} }';

ruleTester.run('events-consumer-idempotent in the declared style', eventsConsumerIdempotent, {
  valid: [
    at(
      INTEGRATION_HANDLER,
      declaring(
        'CommandBus, IntegrationEventHandler',
        `@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [CommandBus])\n${REACTION}`,
      ),
      DECLARED,
    ),
    at(
      INTEGRATION_HANDLER,
      declaring(
        'IntegrationEventHandler as Handles',
        `@Handles(productListedV1, { ...shared, consumer: \`billing.catalog-product-listed\` }, [])\n${REACTION}`,
      ),
      DECLARED,
    ),
    at(INTEGRATION_HANDLER, REACTION, DECLARED),
    at(
      INTEGRATION_HANDLER,
      `import { IntegrationEventHandler } from './home-made.js';\n@IntegrationEventHandler(productListedV1)\n${REACTION}`,
      DECLARED,
    ),
    at(
      INTEGRATION_HANDLER,
      declaring(
        'IntegrationEventHandler',
        `@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\n${REACTION}`,
      ),
      EXPLICIT,
    ),
    at(
      INTEGRATION_HANDLER,
      declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`),
    ),
    at(SPEC, declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`), DECLARED),
    at(
      MODULE,
      "builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedHandler, [CommandBus]);",
      DECLARED,
    ),
  ],
  invalid: [
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring(
          'IntegrationEventHandler',
          `@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\n${REACTION}`,
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' },
        },
      ],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring(
          'IntegrationEventHandler',
          `@IntegrationEventHandler(productListedV1, { consumer: \`billing.\${reaction}\` }, [])\n${REACTION}`,
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' },
        },
      ],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring(
          'IntegrationEventHandler',
          `@IntegrationEventHandler(productListedV1, { consumer: '' }, [])\n${REACTION}`,
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'empty', context: 'billing' },
        },
      ],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1)\n${REACTION}`),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'missing', context: 'billing' },
        },
      ],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, {}, [])\n${REACTION}`),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'missing', context: 'billing' },
        },
      ],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring('IntegrationEventHandler', `@IntegrationEventHandler(productListedV1, options, [])\n${REACTION}`),
        DECLARED,
      ),
      errors: [{ messageId: 'declaredName' }],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        `import * as declarations from '${DECLARATIONS}';\n@declarations.IntegrationEventHandler(productListedV1, { ...shared })\n${REACTION}`,
        DECLARED,
      ),
      errors: [
        {
          messageId: 'declaredName',
          data: { className: 'CatalogProductListedHandler', problem: 'not a string literal', context: 'billing' },
        },
      ],
    },
    {
      ...at(MODULE, 'builder.on(productListedV1).handledBy(ProductListedHandler, [CommandBus]);', DECLARED),
      errors: [{ messageId: 'consumerName' }],
    },
    {
      ...at(
        INTEGRATION_HANDLER,
        "this.subscriber.subscribe('catalog.product.listed', (event) => this.handle(event));",
        DECLARED,
      ),
      errors: [{ messageId: 'directSubscribe' }],
    },
  ],
});

const CATALOG_PORT = "'../../../../catalog/application/ports/product-reader.port.js'";
const CATALOG_LANGUAGE = "'../../../../catalog/published-language/index.js'";

ruleTester.run('context-extractable in the declared style', contextExtractable, {
  valid: [
    at(
      HANDLER,
      `import { CommandHandler } from '${DECLARATIONS}';\nimport { Clock, DomainEventDispatcher } from '@ddd-ts-kit/kernel';\nimport { Access } from '@ddd-ts-kit/auth';\nimport { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';\nimport { PaymentGateway } from '../../ports/payment-gateway.port.js';\nimport { Database } from '#src/platform/database/database.port.js';`,
      DECLARED,
    ),
    at(INTEGRATION_HANDLER, `import { productListedV1, type ProductListedV1 } from ${CATALOG_LANGUAGE};`, DECLARED),
    at(
      REPOSITORY,
      "import { Database } from '../../../../platform/database/database.port.js';\nimport { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\nimport { DEFAULT_CURRENCY } from '#src/shared-kernel/money.vo.js';\nimport { SQL } from 'drizzle-orm';",
      DECLARED,
    ),
    at(HANDLER, `import { ProductReader } from ${CATALOG_PORT};`, EXPLICIT),
    at(HANDLER, `import { ProductReader } from ${CATALOG_PORT};`),
    at(PORT, `import { ProductReader } from ${CATALOG_PORT};`, DECLARED),
    at(
      HANDLER,
      "import { ProductReader } from '../../../../catalog/application/ports/product-reader.js';\nimport { toPrice } from '../../../../catalog/application/ports/product-reader.port.spec.js';",
      DECLARED,
    ),
    at(MAPPER, `import { ProductReader } from ${CATALOG_PORT};`, DECLARED),
    at(SPEC, `import { ProductReader } from ${CATALOG_PORT};`, DECLARED),
    at(
      MODULE,
      "import { CatalogReader } from '#src/contexts/catalog/application/ports/catalog-reader.port.js';\nexport const all = describe(CatalogReader);",
      DECLARED,
    ),
  ],
  invalid: [
    {
      ...at(HANDLER, `import { ProductReader } from ${CATALOG_PORT};`, DECLARED),
      errors: [{ messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'ProductReader' } }],
    },
    {
      ...at(QUERY_HANDLER, `import { ProductReader as products, type ProductReader } from ${CATALOG_PORT};`, DECLARED),
      errors: [
        { messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'ProductReader' } },
        { messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'ProductReader' } },
      ],
    },
    {
      ...at(
        GATEWAY,
        "import { ProductRepository, type Product } from '#src/contexts/catalog/domain/repositories/product.repository.js';",
        DECLARED,
      ),
      errors: [
        { messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'ProductRepository' } },
        { messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'Product' } },
      ],
    },
    {
      ...at(COMMAND, `import * as catalog from ${CATALOG_PORT};`, DECLARED),
      errors: [{ messageId: 'foreignPort', data: { here: 'billing', there: 'catalog', name: 'catalog' } }],
    },
    {
      ...at(
        MODULE,
        "import { CatalogReader } from '#src/contexts/catalog/application/ports/catalog-reader.port.js';\nbuilder.query(GetPrice).public().handledBy(GetPriceHandler, [CatalogReader]);",
        DECLARED,
      ),
      errors: [{ messageId: 'foreignWiring' }],
    },
  ],
});
