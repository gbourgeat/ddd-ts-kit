import { contextExtractable } from '../../src/rules/context-extractable.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const SCHEMA = `${BILLING}/infrastructure/persistence/billing.schema.ts`;
const REPOSITORY = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const PORT = `${BILLING}/application/ports/rate-cache.port.ts`;
const CONFIG = { contexts: { billing: {}, catalog: {}, 'order-management': {} } };

ruleTester.run('context-extractable', contextExtractable, {
  valid: [
    at(SCHEMA, "export const billingSchema = contextSchema('billing');", CONFIG),
    at(SCHEMA, "export const audit = contextSchema('audit');", CONFIG),
    at(SCHEMA, 'export const schema = contextSchema(name);', CONFIG),
    at(REPOSITORY, 'const rows = await knex.raw(`select * from billing.invoices where id = ${id}`);', CONFIG),
    at(REPOSITORY, "const label = 'catalog.products';\nconst text = `the catalog. Next`;", CONFIG),
    at(REPOSITORY, 'const rows = await sql`select i.catalog.x from billing.invoices i`;', CONFIG),
    at(REPOSITORY, "import { rows } from './select-from-catalog.fixtures.js';", CONFIG),
    at(
      `${BILLING}/infrastructure/external/reporting.ts`,
      'const rows = await sql`select * from catalog.products`;',
      CONFIG,
    ),
    at(
      PORT,
      'export const RATES = new Map([[1, 2]]);\nexport const NAMES = [];\nexport const limits = { max: 3 };\nconst size = RATES.get(1) ?? NAMES.length + limits.max;',
      CONFIG,
    ),
    at(
      PORT,
      'const cache = new Map<string, number>();\ncache.set("a", 1);\nexport function rate(): number { return cache.size; }',
      CONFIG,
    ),
    at('src/platform/registry.ts', 'export let current = 0;\nexport const all = [];\nall.push(1);', CONFIG),
    at(`${BILLING}/test/fakes/rates.fake.ts`, 'export let calls = 0;', CONFIG),
    at(
      MODULE,
      "import { Clock } from '@ddd-ts-kit/kernel';\nimport { PlatformDatabase } from '@/platform/database/platform-database.port.js';\nimport { productListedV1 } from '@/contexts/catalog/published-language/index.js';\nbuilder.bind(InvoiceRepository).toClass(Repo, [PlatformDatabase, Clock]);\nbuilder.on(productListedV1, { consumer: 'billing.x' }).handledBy(Handler, [resolve(Clock)]);",
      CONFIG,
    ),
    at(
      MODULE,
      "import { CatalogReader } from '@/contexts/catalog/application/ports/catalog-reader.port.js';\nexport const all = describe(CatalogReader);",
      CONFIG,
    ),
  ],
  invalid: [
    {
      ...at(SCHEMA, "export const catalog = contextSchema('catalog');", CONFIG),
      errors: [{ messageId: 'foreignSchema', data: { here: 'billing', there: 'catalog' } }],
    },
    {
      ...at(SCHEMA, 'const name = kernel.schemaNameOf(`order-management`);', CONFIG),
      errors: [{ messageId: 'foreignSchema', data: { here: 'billing', there: 'order-management' } }],
    },
    {
      ...at(
        REPOSITORY,
        'const rows = await sql`select * from billing.invoices i join catalog.products p on p.id = i.product_id`;',
        CONFIG,
      ),
      errors: [{ messageId: 'foreignTable', data: { here: 'billing', there: 'catalog' } }],
    },
    {
      ...at(
        REPOSITORY,
        'const rows = await knex.raw(`SELECT total FROM "order_management".orders WHERE id = ${id}`);',
        CONFIG,
      ),
      errors: [{ messageId: 'foreignTable', data: { here: 'billing', there: 'order-management' } }],
    },
    {
      ...at(
        REPOSITORY,
        "await knex.raw('alter table billing.invoices add foreign key (product_id) references catalog.products (id)');",
        CONFIG,
      ),
      errors: [{ messageId: 'foreignTable' }],
    },
    {
      ...at(PORT, 'export let current = 0;', CONFIG),
      errors: [{ messageId: 'mutableBinding', data: { name: 'current', kind: 'let', here: 'billing' } }],
    },
    { ...at(PORT, 'let current = 0;\nexport { current };', CONFIG), errors: [{ messageId: 'mutableBinding' }] },
    {
      ...at(
        PORT,
        'export const cache = new Map<string, number>();\nexport function remember(key: string): void { cache.set(key, 1); }',
        CONFIG,
      ),
      errors: [{ messageId: 'mutableState', data: { name: 'cache', here: 'billing' } }],
    },
    { ...at(PORT, 'export const seen = [];\nseen.push(1);', CONFIG), errors: [{ messageId: 'mutableState' }] },
    {
      ...at(PORT, "const registry = {};\nregistry['a'] = 1;\nexport { registry };", CONFIG),
      errors: [{ messageId: 'mutableState', data: { name: 'registry', here: 'billing' } }],
    },
    {
      ...at(PORT, 'export const counters = { sent: 0 };\ncounters.sent++;', CONFIG),
      errors: [{ messageId: 'mutableState' }],
    },
    {
      ...at(PORT, 'export const defaults = {};\nObject.assign(defaults, overrides);', CONFIG),
      errors: [{ messageId: 'mutableState' }],
    },
    {
      ...at(
        PORT,
        'export const pending = new Set<string>();\nfunction done(id: string): void { pending.delete(id); }',
        CONFIG,
      ),
      errors: [{ messageId: 'mutableState' }],
    },
    {
      ...at(
        MODULE,
        "import { CatalogReader } from '@/contexts/catalog/application/ports/catalog-reader.port.js';\nbuilder.query(GetPrice).public().handledBy(GetPriceHandler, [CatalogReader]);",
        CONFIG,
      ),
      errors: [{ messageId: 'foreignWiring', data: { here: 'billing', there: 'catalog', name: 'CatalogReader' } }],
    },
    {
      ...at(
        MODULE,
        "import { ProductRepository as CatalogProducts } from '../catalog/domain/repositories/product.repository.js';\nconst products = resolve(CatalogProducts);",
        CONFIG,
      ),
      errors: [{ messageId: 'foreignWiring', data: { here: 'billing', there: 'catalog', name: 'CatalogProducts' } }],
    },
    {
      ...at(
        MODULE,
        "import { DrizzleProductRepository } from '@/contexts/catalog/infrastructure/persistence/drizzle-product.repository.js';\nbuilder.bind(Products).toClass(DrizzleProductRepository, [Database]);\nbuilder.rebind(DrizzleProductRepository);",
        CONFIG,
      ),
      errors: [{ messageId: 'foreignWiring' }, { messageId: 'foreignWiring' }],
    },
  ],
});
