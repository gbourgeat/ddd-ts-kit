import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';

const { BILLING, PORT, REPOSITORY_PORT } = PATHS;
const SCHEMA = `${BILLING}/infrastructure/persistence/invoice.schema.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;
const SPEC = `${BILLING}/test/unit/attach-receipt.handler.spec.ts`;
const READER = `${BILLING}/infrastructure/persistence/search-invoice-list.reader.ts`;
const READER_SPEC = `${BILLING}/test/integration/search-invoice.reader.spec.ts`;
const LOOSE_LIST = `${BILLING}/infrastructure/persistence/loose-list.reader.ts`;
const LOOSE = `${BILLING}/infrastructure/persistence/loose-invoices.reader.ts`;

/** An adapter as the guidance writes it: the store extended, its options asked of the platform, a field of the row named `transport`. */
const SEARCH_ADAPTER = [
  "import { defineCriteria } from '@ddd-ts-kit/kernel';",
  "import { OpenSearchReadModelStore, UnprovisionedIndexError } from '@ddd-ts-kit/opensearch';",
  "import type { SearchIndexes } from '@/platform/search/search-indexes.js';",
  '',
  'interface InvoiceRow {',
  '  readonly id: string;',
  '  readonly transport: string;',
  '}',
  '',
  "const criteria = defineCriteria<InvoiceRow>({ fields: { id: { type: 'string', filter: ['eq'] } }, tieBreaker: 'id' });",
  '',
  'export class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> {',
  '  static readonly refused = UnprovisionedIndexError;',
  '',
  '  constructor(search: SearchIndexes) {',
  "    super(search.options('billing_invoices', criteria, { fields: { transport: 'string' } }));",
  '  }',
  '}',
  '',
].join('\n');

export const FILES_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'files/port-not-connector',
    name: 'a port on the file storage port, a spec on the in-memory connector',
    expect: 'pass',
    files: project({
      [PORT]:
        "import type { FileStorage, StoredFile } from '@ddd-ts-kit/kernel';\nexport abstract class PaymentGateway {\n  abstract receipts(): FileStorage;\n\n  abstract lastReceipt(): StoredFile;\n}\n",
      [SPEC]:
        "import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';\nexport const storage = new InMemoryFileStorage();\n",
    }),
  },
  {
    ruleId: 'files/port-not-connector',
    name: 'a port of the application that names the local connector',
    expect: { file: PORT },
    files: project({
      [PORT]:
        "import type { LocalFileStorage } from '@ddd-ts-kit/kernel';\nexport abstract class PaymentGateway {\n  abstract receipts(): LocalFileStorage;\n}\n",
    }),
  },
  {
    ruleId: 'files/port-not-connector',
    name: 'a repository port of the domain that names the in-memory connector',
    expect: { file: REPOSITORY_PORT },
    files: project({
      [REPOSITORY_PORT]:
        "import type { InMemoryFileStorage } from '@ddd-ts-kit/kernel';\nexport abstract class InvoiceRepository {\n  abstract receipts(): InMemoryFileStorage;\n}\n",
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a table that keeps the reference of a stored file, its key, size, type and checksum',
    expect: 'pass',
    files: project({
      [SCHEMA]:
        "// No bytea here: the content is in the file storage.\nexport const invoices = pgTable('invoices', {\n  receiptKey: text('receipt_key'),\n  receiptSize: integer('receipt_size'),\n  receiptMediaType: text('receipt_media_type'),\n  receiptChecksum: text('receipt_checksum'),\n});\n",
      'migrations/20261012093000_add-receipts.sql': 'ALTER TABLE "invoices" ADD COLUMN "receipt_key" text;\n',
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a repository that encodes its keyset cursor in base64, and a link to a blob in a trailing comment',
    expect: 'pass',
    files: project({
      [ADAPTER]:
        "export class DrizzleInvoiceRepository {\n  cursorOf(id: string): string {\n    const documented = 'https://github.com/acme/app/blob/main/CURSORS.md';\n\n    return Buffer.from(`${id} ${documented}`).toString('base64url'); // https://github.com/acme/app/blob/main/README.md\n  }\n}\n",
      'migrations/20261012093000_add-receipts.sql':
        'ALTER TABLE "invoices" ADD COLUMN "receipt_key" text; -- not a blob: the key of the file\n',
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a SQL migration that adds a column of base64 text',
    expect: { file: 'migrations/20261012093000_add-receipts.sql' },
    files: project({
      'migrations/20261012093000_add-receipts.sql': 'ALTER TABLE "invoices" ADD COLUMN "receipt_base64" text;\n',
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a drizzle column of bytes',
    expect: { file: SCHEMA },
    files: project({
      [SCHEMA]: "export const invoices = pgTable('invoices', {\n  receipt: bytea('receipt'),\n});\n",
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a knex migration that adds a binary column',
    expect: { file: 'migrations/20261012093000_add-receipts.js' },
    files: project({
      'migrations/20261012093000_add-receipts.js':
        "export const up = (knex) => knex.schema.alterTable('invoices', (table) => {\n  table.binary('receipt');\n});\n",
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a column of base64 text in the database schema of the platform',
    expect: { file: 'src/platform/database/schema.ts' },
    files: project({
      'src/platform/database/schema.ts':
        "export const receipts = pgTable('receipts', {\n  contentBase64: text('content_base64'),\n});\n",
    }),
  },
  {
    ruleId: 'persistence/no-file-content',
    name: 'a Prisma field of bytes',
    expect: { file: 'prisma/schema/billing.prisma' },
    files: project({
      'prisma/schema/billing.prisma': 'model Receipt {\n  id      String @id\n  content Bytes\n}\n',
    }),
  },
  {
    ruleId: 'search/store-from-platform',
    name: 'an adapter built from the options of the platform, a row field named transport, a spec that opens a node of its own',
    expect: 'pass',
    files: project({
      [READER]: SEARCH_ADAPTER,
      [READER_SPEC]:
        "import { fetchTransport } from '@ddd-ts-kit/opensearch';\nexport const transport = fetchTransport({ node: 'http://localhost:9200' });\n",
    }),
  },
  {
    ruleId: 'search/store-from-platform',
    name: 'the options of the platform spread with another tenancy, in a file that does not import the package',
    expect: { file: LOOSE },
    files: project({
      [LOOSE_LIST]:
        "import { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';\nexport class LooseList extends OpenSearchReadModelStore<{ readonly id: string }> {}\n",
      [LOOSE]:
        "import type { SearchIndexes } from '@/platform/search/search-indexes.js';\nimport { LooseList } from '@/contexts/billing/infrastructure/persistence/loose-list.reader.js';\nexport const looseInvoices = (search: SearchIndexes, definition: never) =>\n  new LooseList({ ...search.options('billing_invoices', definition), tenancy: { strategy: 'none' } });\n",
    }),
  },
  {
    ruleId: 'search/store-from-platform',
    name: 'an adapter that opens a transport of its own',
    expect: { file: READER },
    files: project({
      [READER]:
        "import { OpenSearchReadModelStore, fetchTransport } from '@ddd-ts-kit/opensearch';\nexport const store = OpenSearchReadModelStore;\nexport const transport = fetchTransport({ node: 'http://search:9200' });\n",
    }),
  },
  {
    ruleId: 'search/store-from-platform',
    name: 'an adapter that takes the options of the platform and overrides their tenancy',
    expect: { file: READER },
    files: project({
      [READER]:
        "import { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';\nexport const options = (given: object) => ({ ...given, tenancy: { strategy: 'none' } });\nexport const store = OpenSearchReadModelStore;\n",
    }),
  },
  {
    ruleId: 'search/store-from-platform',
    name: 'a port of the application that names the store',
    expect: { file: PORT },
    also: ['layer/application-inward'],
    files: project({
      [PORT]:
        "import type { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';\nexport abstract class PaymentGateway {\n  abstract receipts(): OpenSearchReadModelStore<object>;\n}\n",
    }),
  },
];
