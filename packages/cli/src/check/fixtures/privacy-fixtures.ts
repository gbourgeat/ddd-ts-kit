import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { BILLING, CATALOG, INTEGRATION_HANDLER, INTEGRATION_HANDLER_SPEC, PAYMENT_ADAPTER } = PATHS;
const TABLES = `${BILLING}/infrastructure/persistence/create-billing-tables.schema.ts`;
const DECLARATION = `${BILLING}/infrastructure/persistence/invoice.personal-fields.ts`;
const MAPPER = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;
const EVENT = `${CATALOG}/published-language/product-listed.v1.integration-event.ts`;
const PAYLOAD = `${CATALOG}/published-language/product-listed.v1.payload.ts`;
const ERASURE = `${BILLING}/application/ports/billing-personal-data-erasure.port.ts`;

const SELLER_EMAIL = '  payload: zodSchema(z.object({ productId: z.string(), sellerEmail: z.string() })),';
const DECLARED_SELLER = "  personal: { subject: 'productId', fields: ['sellerEmail'] },";

const CONSUMER = source(
  'export class ProductListedIntegrationHandler {',
  '  static readonly eventType = productListedV1.type;',
  '}',
);

export const PRIVACY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'privacy/declared-field',
    name: 'a column named like personal data that a declaration of its context names',
    expect: 'pass',
    files: privacyOn({
      [TABLES]: knexTable("table.text('customer_email');"),
      [DECLARATION]: declaration("{ subject: 'id', fields: ['customer_email'], erasure: 'pseudonymise' }"),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a key of an event mapper that personalData seals in the same file, on the write and the read side',
    expect: 'pass',
    files: privacyOn({
      [MAPPER]: source(
        'function borrowerDataOf(subject: string, borrower: Borrower) {',
        '  return { postalAddress: personalData(subject, borrower.postalAddress) };',
        '}',
        'function borrowerOf(data: StoredEventData) {',
        "  return Borrower.create(data.text('postalAddress'));",
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a key of an event mapper named like personal data and stored in clear, beside one that is sealed',
    expect: { file: MAPPER },
    files: privacyOn({
      [MAPPER]: source(
        'function borrowerDataOf(subject: string, borrower: Borrower) {',
        '  return { postalAddress: personalData(subject, borrower.postalAddress), email: borrower.email };',
        '}',
        'function borrowerOf(data: StoredEventData) {',
        "  return Borrower.create(data.text('postalAddress'), data.text('email'));",
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'an undeclared column named like personal data, in a project whose privacy is off',
    expect: 'pass',
    files: project({ [TABLES]: knexTable("table.text('customer_email');") }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a column named in a comment only, and a word the config allows',
    expect: 'pass',
    files: privacyOn(
      {
        [TABLES]: knexTable("/** The phone, table.text('customer_phone'), is kept by crm. */", "table.text('street');"),
      },
      { privacy: { allow: ['street'] } },
    ),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a Knex column named like personal data that no declaration names',
    expect: { file: TABLES },
    files: privacyOn({ [TABLES]: knexTable("table.text('customer_email');") }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a Drizzle column whose property and column the declaration names in another spelling, and one it forgets',
    expect: { file: `${BILLING}/infrastructure/persistence/billing.schema.ts` },
    files: privacyOn({
      [`${BILLING}/infrastructure/persistence/billing.schema.ts`]: source(
        "export const invoices = billingSchema.table('invoices', {",
        "  customerEmail: text('customer_email'),",
        "  customerPhone: text('customer_phone'),",
        '});',
      ),
      [DECLARATION]: source(
        "import { personalFields } from '@ddd-ts-kit/kernel';",
        '',
        "export const InvoicePersonalFields = personalFields(invoices, { subject: 'id', fields: ['customerEmail'], erasure: 'row' });",
      ),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a TypeORM column of the entity schema named like personal data',
    expect: { file: `${BILLING}/infrastructure/persistence/billing.schema.ts` },
    files: privacyOn({
      [`${BILLING}/infrastructure/persistence/billing.schema.ts`]: source(
        "export const invoices = new EntitySchema({ name: 'Invoice', tableName: 'invoices', columns: {",
        "  id: { type: 'text', primary: true },",
        "  birthDate: { name: 'birth_date', type: 'date' },",
        '} });',
      ),
    }),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a column of a word the config adds to the vocabulary',
    expect: { file: TABLES },
    files: privacyOn(
      { [TABLES]: knexTable("table.text('patient_number');") },
      { privacy: { vocabulary: ['patient_number'] } },
    ),
  },
  {
    ruleId: 'privacy/declared-field',
    name: 'a column of a Prisma model in the schema of a context, named like personal data',
    expect: { file: 'prisma/schema/billing.prisma' },
    files: privacyOn({
      'prisma/schema/billing.prisma': source(
        'model Invoice {',
        '  id            String @id',
        '  customerEmail String @map("customer_email")',
        '  @@map("invoices")',
        '  @@schema("billing")',
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/event-payload-declared',
    name: 'a field of the payload named like personal data that the personal option lists',
    expect: 'pass',
    files: privacyOn({ [EVENT]: event([DECLARED_SELLER, SELLER_EMAIL]) }),
  },
  {
    ruleId: 'privacy/event-payload-declared',
    name: 'a nested field the personal option lists by its path',
    expect: 'pass',
    files: privacyOn({
      [EVENT]: event([
        "  personal: { subject: 'productId', fields: ['seller.email'] },",
        '  payload: zodSchema(z.object({ productId: z.string(), seller: z.object({ email: z.string() }) })),',
      ]),
    }),
  },
  {
    ruleId: 'privacy/event-payload-declared',
    name: 'a field of the payload named like personal data, without a personal option',
    expect: { file: EVENT },
    files: privacyOn({ [EVENT]: event([SELLER_EMAIL]) }),
  },
  {
    ruleId: 'privacy/event-payload-declared',
    name: 'a member of the payload class named like personal data, the option listing another field',
    expect: { file: PAYLOAD },
    files: privacyOn({
      [EVENT]: event([DECLARED_SELLER, '  payload: classSchema(ProductListedV1Payload),']),
      [PAYLOAD]: source(
        'export class ProductListedV1Payload {',
        "  productId = '';",
        '',
        "  sellerEmail = '';",
        '',
        '  readonly sellerPhone?: string;',
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/event-payload-declared',
    name: 'a declared member of the payload class named like personal data, the option listing another field',
    expect: { file: PAYLOAD },
    files: privacyOn({
      [EVENT]: event([DECLARED_SELLER, '  payload: classSchema(ProductListedV1Payload),']),
      [PAYLOAD]: source(
        'export class ProductListedV1Payload {',
        '  declare productId: string;',
        '',
        '  declare sellerEmail: string;',
        '',
        '  declare readonly sellerPhone?: string;',
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/erasure-reaches-copies',
    name: 'a consumer of an event that carries personal data, which declares its erasure',
    expect: 'pass',
    files: privacyOn({
      [EVENT]: event([DECLARED_SELLER, SELLER_EMAIL]),
      [INTEGRATION_HANDLER]: CONSUMER,
      [INTEGRATION_HANDLER_SPEC]: SAMPLES.SPEC,
      [ERASURE]: source(
        "import { PersonalDataErasure } from '@ddd-ts-kit/kernel';",
        '',
        'export abstract class BillingPersonalDataErasure extends PersonalDataErasure {}',
      ),
    }),
  },
  {
    ruleId: 'privacy/erasure-reaches-copies',
    name: 'a consumer of an event that carries personal data, which handles the erasure announced',
    expect: 'pass',
    files: privacyOn({
      [EVENT]: event([DECLARED_SELLER, SELLER_EMAIL]),
      [INTEGRATION_HANDLER]: CONSUMER,
      [INTEGRATION_HANDLER_SPEC]: SAMPLES.SPEC,
      [`${BILLING}/application/integration/handlers/data-subject-erased.integration-handler.ts`]: source(
        "import { dataSubjectErasedV1 } from '@ddd-ts-kit/kernel';",
        '',
        'export class DataSubjectErasedIntegrationHandler {',
        '  static readonly eventType = dataSubjectErasedV1.type;',
        '}',
      ),
      [`${BILLING}/test/unit/data-subject-erased.integration-handler.spec.ts`]: SAMPLES.SPEC,
    }),
  },
  {
    ruleId: 'privacy/erasure-reaches-copies',
    name: 'a consumer of an event that carries personal data, which erases nothing',
    expect: { file: INTEGRATION_HANDLER },
    files: privacyOn({
      [EVENT]: event([DECLARED_SELLER, SELLER_EMAIL]),
      [INTEGRATION_HANDLER]: CONSUMER,
      [INTEGRATION_HANDLER_SPEC]: SAMPLES.SPEC,
    }),
  },
  {
    ruleId: 'privacy/subject-is-opaque',
    name: 'a declaration whose subject is an opaque identifier',
    expect: 'pass',
    files: privacyOn({
      [DECLARATION]: declaration("{ subject: 'customer_id', fields: ['customer_email'], erasure: 'row' }"),
    }),
  },
  {
    ruleId: 'privacy/subject-is-opaque',
    name: 'a declaration whose subject is an email',
    expect: { file: DECLARATION },
    files: privacyOn({
      [DECLARATION]: declaration("{ subject: 'customer_email', fields: ['display_name'], erasure: 'row' }"),
    }),
  },
  {
    ruleId: 'privacy/subject-is-opaque',
    name: 'an event whose subject is one of its personal fields',
    expect: { file: EVENT },
    files: privacyOn({
      [EVENT]: event(["  personal: { subject: 'sellerId', fields: ['sellerId', 'sellerEmail'] },", SELLER_EMAIL]),
    }),
  },
  {
    ruleId: 'privacy/no-personal-data-in-logs',
    name: 'a log line that names the person by an opaque id, and a declared field of one common word',
    expect: 'pass',
    files: privacyOn({
      [DECLARATION]: declaration("{ subject: 'id', fields: ['customer_email', 'name'], erasure: 'row' }"),
      [PAYMENT_ADAPTER]: source(
        'export class RemotePaymentGateway {',
        '  constructor(private readonly logger: { info(message: string, fields: object): void }) {}',
        '',
        '  charge(customerId: string, name: string): void {',
        "    this.logger.info('charged', { customerId, name });",
        '  }',
        '}',
      ),
    }),
  },
  {
    ruleId: 'privacy/no-personal-data-in-logs',
    name: 'a log line that names a declared personal field',
    expect: { file: PAYMENT_ADAPTER },
    files: privacyOn({
      [DECLARATION]: declaration("{ subject: 'id', fields: ['customer_email'], erasure: 'row' }"),
      [PAYMENT_ADAPTER]: source(
        'export class RemotePaymentGateway {',
        '  constructor(private readonly logger: { info(message: string, fields: object): void }) {}',
        '',
        '  charge(customerEmail: string): void {',
        "    this.logger.info('charged', { customerEmail });",
        '  }',
        '}',
      ),
    }),
  },
];

/** A project whose platform answers the requests of a data subject, with what a fixture adds to its config. */
function privacyOn(files: FixtureFiles, written: Record<string, unknown> = {}): FixtureFiles {
  return project(files, { [CONFIG_FILE]: config({ stack: { privacy: 'on', orm: 'knex' }, ...written }) });
}

function knexTable(...columns: string[]): string {
  return source(
    "import type { Knex } from 'knex';",
    '',
    'export function createBillingTables(knex: Knex): Promise<void> {',
    "  return knex.schema.withSchema('billing').createTable('invoices', (table) => {",
    "    table.text('id').primary();",
    ...columns.map((column) => `    ${column}`),
    '  });',
    '}',
  );
}

function declaration(options: string): string {
  return source(
    "import { personalFields } from '@ddd-ts-kit/kernel';",
    '',
    `export const InvoicePersonalFields = personalFields({ schema: 'billing', table: 'invoices' }, ${options});`,
  );
}

function event(lines: readonly string[]): string {
  return source(
    "import { defineIntegrationEvent } from '@ddd-ts-kit/events';",
    "import { zodSchema } from '@ddd-ts-kit/validation/zod';",
    "import { z } from 'zod';",
    '',
    'export const productListedV1 = defineIntegrationEvent({',
    "  type: 'catalog.product.listed',",
    '  version: 1,',
    ...lines,
    '});',
  );
}
