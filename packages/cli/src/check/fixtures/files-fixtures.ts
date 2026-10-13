import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { BILLING, PORT, REPOSITORY_PORT } = PATHS;
const SCHEMA = `${BILLING}/infrastructure/persistence/invoice.schema.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;
const SPEC = `${BILLING}/test/unit/attach-receipt.handler.spec.ts`;

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
    expect: { file: 'prisma/schema.prisma' },
    files: project({
      'prisma/schema.prisma': 'model Receipt {\n  id      String @id\n  content Bytes\n}\n',
    }),
  },
];
