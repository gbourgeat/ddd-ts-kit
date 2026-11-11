import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { failure } from './reports';
import { billingSchemaFile, billingWithATableOfItsOwn } from './support/billing-with-a-table-of-its-own';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';
const DECLARATION = `${PERSISTENCE}/payment-reminders.personal-fields.ts`;
const SPEC = 'src/contexts/billing/test/integration/billing-personal-data.spec.ts';
const REMINDERS = ['generate', 'personal-fields', 'billing', 'payment_reminders'];
const PERSONAL = ['--personal', 'customer_email,customer_name', '--subject', 'customer_id'];

const KNEX_REMINDERS = `  await knex.schema.withSchema(BILLING_SCHEMA).createTable('payment_reminders', (table) => {
    table.text('id').primary();
    table.text('customer_id').notNullable();
    table.text('customer_email');
    table.text('customer_name');
  });
`;

describe('generate personal-fields, what it asks for before it writes', () => {
  it('requires --personal and --subject, and says why no default names the subject of a table without aggregate', () => {
    const root = billingWithATableOfItsOwn('knex');
    const columns = failure(cli(root, ...REMINDERS, '--subject', 'customer_id', '--json'));
    const subject = failure(cli(root, ...REMINDERS, '--personal', 'customer_email', '--json'));

    expect(columns.message).toBe(
      'generate personal-fields needs --personal: the columns of the table that hold personal data.',
    );

    expect(subject.message).toBe(
      'generate personal-fields needs --subject: the column that holds the id of the person a row is about.',
    );

    expect(subject.fix).toContain('on a table without aggregate the row is rarely the person');
    expect(subject.fix).toContain('miss the row while the register says the column is covered');
    expect(exists(root, DECLARATION)).toBe(false);
  });

  it('refuses a name that is not a table name, and the columns --personal of a repository refuses', () => {
    const root = billingWithATableOfItsOwn('knex');

    const named = failure(
      cli(root, 'generate', 'personal-fields', 'billing', 'PaymentReminders', ...PERSONAL, '--json'),
    );

    const own = failure(cli(root, ...REMINDERS, '--personal', 'created_at', '--subject', 'customer_id', '--json'));

    expect(named.message).toBe('"PaymentReminders" is not a table name.');
    expect(named.fix).toContain('as the database spells it');
    expect(own.message).toContain('--personal names "created_at"');
  });

  it('refuses a project that answers no request of a data subject, and a storage no erasure adapter of the kit reads', () => {
    const off = initProject('--privacy', 'off');
    const memory = initProject('--orm', 'none', '--privacy', 'on');

    for (const root of [off, memory]) {
      expectOk(cli(root, 'generate', 'context', 'billing', '--classification', 'core'));
    }

    expect(failure(cli(off, ...REMINDERS, ...PERSONAL, '--json')).fix).toContain('init --force --privacy on');

    expect(failure(cli(memory, ...REMINDERS, ...PERSONAL, '--json')).message).toBe(
      '--personal is generated for knex, drizzle, prisma and typeorm: with --orm none, no erasure adapter of the kit reads the declaration.',
    );
  });

  it('refuses a table of a context whose schema declares none yet, and writes none', () => {
    const root = initProject();

    expectOk(cli(root, 'generate', 'context', 'billing', '--classification', 'core'));

    const refused = failure(cli(root, ...REMINDERS, ...PERSONAL, '--json'));

    expect(refused.message).toBe(
      `The schema of billing (${billingSchemaFile('drizzle')}) declares no table "payment_reminders".`,
    );

    expect(refused.fix).toContain('it writes no table: name one the schema declares (none yet), or write the table in');
    expect(exists(root, billingSchemaFile('drizzle'))).toBe(false);
  });
});

describe('generate personal-fields, in a context that already erases personal data', () => {
  it('joins the declaration to the erasure and to the export of the context, and leaves their spec as it was', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);
    const schema = billingSchemaFile('knex');
    const spec = read(root, SPEC);

    write(
      root,
      schema,
      read(root, schema).replace('  // /ddd-ts-kit:tables', `${KNEX_REMINDERS}  // /ddd-ts-kit:tables`),
    );

    const joined = expectOk(cli(root, ...REMINDERS, ...PERSONAL));

    expect(joined.stdout).toContain(
      'PaymentRemindersPersonalFields joined the declarations of KnexBillingPersonalDataErasure and KnexBillingPersonalDataExport: their spec (test/integration/billing-personal-data.spec.ts) covers the tables declared before, add this one to it.',
    );

    for (const port of ['erasure', 'export']) {
      expect(read(root, `${PERSISTENCE}/knex-billing-personal-data-${port}.repository.ts`)).toContain(
        '        InvoicePersonalFields,\n        PaymentRemindersPersonalFields,\n        // /ddd-ts-kit:personal-fields',
      );
    }

    expect(read(root, SPEC)).toBe(spec);
  });

  it('refuses the table of an aggregate that has its declaration, whatever its file is named', () => {
    const root = billingWithPersonalInvoices(['--orm', 'drizzle']);

    const refused = failure(
      cli(
        root,
        'generate',
        'personal-fields',
        'billing',
        'invoices',
        '--personal',
        'customer_email',
        '--subject',
        'id',
        '--json',
      ),
    );

    expect(refused.message).toBe(
      `${PERSISTENCE}/invoice.personal-fields.ts already declares what the table invoices keeps of a person.`,
    );

    expect(exists(root, `${PERSISTENCE}/invoices.personal-fields.ts`)).toBe(false);
  });
});

describe('generate repository --personal, on an aggregate whose table is declared', () => {
  it('refuses to declare the table a second time, and names generate personal-fields for the columns of an existing table', () => {
    const root = billingWithATableOfItsOwn('knex');
    const tables = read(root, billingSchemaFile('knex'));

    const refused = failure(
      cli(root, 'generate', 'repository', 'billing', 'Invoice', '--personal', 'payer_email', '--json'),
    );

    expect(refused.message).toBe(
      `${billingSchemaFile('knex')} already declares the table invoices, with other columns than this command would write.`,
    );

    expect(refused.fix).toContain(
      '`ddd-ts-kit generate personal-fields billing invoices --personal <column>,... --subject <column>`',
    );

    expect(read(root, billingSchemaFile('knex'))).toBe(tables);
    expect(exists(root, `${PERSISTENCE}/invoice.personal-fields.ts`)).toBe(false);
  });
});
