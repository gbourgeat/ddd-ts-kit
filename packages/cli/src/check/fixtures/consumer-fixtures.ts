import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { BILLING, CATALOG, CATALOG_INTEGRATION_HANDLER, INTEGRATION_HANDLER, INTEGRATION_HANDLER_SPEC, MODULE } = PATHS;
const { SPEC } = SAMPLES;

export const CONSUMER_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'events/consumer-idempotent',
    name: 'integration event handlers registered under their own consumer name, by the builder and by hand',
    expect: 'pass',
    files: project({
      [INTEGRATION_HANDLER]: 'export class ProductListedIntegrationHandler {}\n',
      [INTEGRATION_HANDLER_SPEC]: SPEC,
      [`${BILLING}/application/integration/handlers/product-withdrawn.integration-handler.ts`]: 'export class ProductWithdrawnIntegrationHandler {}\n',
      [`${BILLING}/test/unit/product-withdrawn.integration-handler.spec.ts`]: SPEC,
      [MODULE]: [
        'export function billingModule(builder: Builder): void {',
        '  builder',
        "    .on(productListedV1, { consumer: 'billing.product-listed' })",
        '    .handledBy(ProductListedIntegrationHandler, [CommandBus]);',
        "  process.on('SIGTERM', stop);",
        '}',
        'const productWithdrawnIntegrationHandler = create(commandBus);',
        'export const billingModule = [',
        "  consume(productWithdrawnV1, { consumer: 'billing.product-withdrawn', processed, unitOfWork }, (event) => productWithdrawnIntegrationHandler.handle(event)),",
        "  on(productRenamedV1, rename, { consumer: 'billing.product-renamed', processed: store }),",
        "  subscribe(idempotent('billing.product-archived', store, archive)),",
        '];',
        '',
      ].join('\n'),
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'an integration event handler subscribed without a consumer name',
    expect: { file: INTEGRATION_HANDLER },
    files: project({
      [INTEGRATION_HANDLER]: 'export class ProductListedIntegrationHandler {}\n',
      [INTEGRATION_HANDLER_SPEC]: SPEC,
      [MODULE]: "export const billingModule = subscriber.subscribe('catalog.product.listed', (event) => productListedIntegrationHandler.handle(event));\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name used twice in a module',
    expect: { file: MODULE },
    files: project({
      [MODULE]:
        "export const billingModule = [\n  consume(productListedV1, { consumer: 'billing', processed, unitOfWork }, list),\n  consume(productWithdrawnV1, { consumer: 'billing', processed, unitOfWork }, withdraw),\n];\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name used by two contexts',
    expect: { file: `${CATALOG}/catalog.module.ts` },
    files: project({
      [MODULE]: "export const billingModule = [consume(productListedV1, { consumer: 'product-listed', processed, unitOfWork }, list)];\n",
      [`${CATALOG}/catalog.module.ts`]: "export const catalogModule = [consume(productListedV1, { consumer: 'product-listed', processed, unitOfWork }, index)];\n",
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'a subscription by hand without a processed-event store',
    expect: { file: MODULE },
    files: project({ [MODULE]: "export const billingModule = [on(productListedV1, list, { consumer: 'billing.product-listed' })];\n" }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'declared style: a handler named by its @IntegrationEventHandler, without a module file',
    expect: 'pass',
    files: declaredProject({ [INTEGRATION_HANDLER]: DECLARED.integrationHandler, [INTEGRATION_HANDLER_SPEC]: SPEC }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'explicit style: a handler that declares itself is not looked for in the module file',
    expect: 'pass',
    files: project({ [INTEGRATION_HANDLER]: DECLARED.integrationHandler, [INTEGRATION_HANDLER_SPEC]: SPEC, [MODULE]: 'export const billingModule = {};\n' }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'a declared handler whose consumer name is not a string literal',
    expect: { file: INTEGRATION_HANDLER },
    files: project({
      [INTEGRATION_HANDLER]: "import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@IntegrationEventHandler(productListedV1, { consumer: CONSUMER_NAME }, [])\nexport class ProductListedIntegrationHandler {}\n",
      [INTEGRATION_HANDLER_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name declared by two contexts',
    expect: { file: CATALOG_INTEGRATION_HANDLER },
    files: project({
      [INTEGRATION_HANDLER]: DECLARED.integrationHandler,
      [INTEGRATION_HANDLER_SPEC]: SPEC,
      [CATALOG_INTEGRATION_HANDLER]: "import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@IntegrationEventHandler(productListedV1, { consumer: 'billing.product-listed' }, [])\nexport class ProductListedIntegrationHandler {}\n",
      [`${CATALOG}/test/unit/product-listed.integration-handler.spec.ts`]: SPEC,
    }),
  },
  {
    ruleId: 'events/consumer-idempotent',
    name: 'one consumer name declared by a class and registered in a module',
    expect: { file: MODULE },
    files: project({
      [INTEGRATION_HANDLER]: DECLARED.integrationHandler,
      [INTEGRATION_HANDLER_SPEC]: SPEC,
      [MODULE]: "export const billingModule = [consume(productWithdrawnV1, { consumer: 'billing.product-listed', processed, unitOfWork }, withdraw)];\n",
    }),
  },
];
