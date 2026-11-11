import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read } from './helpers';
import { failure } from './reports';
import { billingWithATableOfItsOwn } from './support/billing-with-a-table-of-its-own';
import { expectOk } from './support/expect-ok';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';
const DECLARATION = `${PERSISTENCE}/payment-reminders.personal-fields.ts`;
const REMINDERS = ['generate', 'personal-fields', 'billing', 'payment_reminders'];
const PERSONAL = ['--personal', 'customer_email,customer_name', '--subject', 'customer_id'];

/** Tables whose definition names some of its columns and takes the others from elsewhere, on each ORM. */
const OPEN: Readonly<Record<string, string>> = {
  drizzle: `// export const former = billingSchema.table('payment_reminders', { customerEmail: text('customer_email') });
export const paymentReminders = billingSchema.table('payment_reminders', {
  id: text('id').primaryKey(),
  customerId: text(),
  ...auditColumns(),
});
`,
  knex: `  await knex.schema.withSchema(BILLING_SCHEMA).createTable('payment_reminders', (table) => {
    table.text('id').primary();
    table.text('customer_id').notNullable();
    auditColumns(table);
  });
`,
  typeorm: `interface PaymentReminderRow {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export const embedded = new EntitySchema<{ id: string }>({ name: 'BillingEmbedded', columns: { id: { type: 'text' } } });

export const paymentReminders = new EntitySchema<PaymentReminderRow>({
  name: 'BillingPaymentReminder',
  tableName: 'payment_reminders',
  schema: BILLING_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    customerId: { name: 'customer_id', type: 'text' },
    ...auditColumns(),
  },
});
`,
};

/** A Prisma model the database names after itself, next to an enum: every column of a model is in its block. */
const PRISMA_UNMAPPED = `enum BillingReminderChannel {
  email
  post

  @@schema("billing")
}

model payment_reminders {
  id             String  @id
  customer_id    String
  customer_email String?
  customer_name  String?

  @@schema("billing")
}
`;

describe.each(Object.keys(OPEN))('a table whose definition takes columns from elsewhere, on %s', (orm) => {
  it('declares the columns it could not read as their SQL name spells them, and says to check that the table holds them', () => {
    const root = billingWithATableOfItsOwn(orm, [], OPEN[orm]);
    const result = expectOk(cli(root, ...REMINDERS, ...PERSONAL));
    const declaration = read(root, DECLARATION);
    const property = orm === 'knex' ? 'customer_id' : 'customerId';

    expect(result.stdout).toContain(
      'takes columns from elsewhere (a spread, a helper), and customer_email, customer_name could not be read in it: check that the table holds them. This generator adds no column to a table.',
    );

    expect(declaration).toContain(`  subject: '${property}',\n`);

    expect(declaration).toContain(
      orm === 'knex' ? "['customer_email', 'customer_name']" : "['customerEmail', 'customerName']",
    );
  });

  it('says so of one column too', () => {
    const root = billingWithATableOfItsOwn(orm, [], OPEN[orm]);
    const result = expectOk(cli(root, ...REMINDERS, '--personal', 'customer_email', '--subject', 'customer_id'));

    expect(result.stdout).toContain('and customer_email could not be read in it: check that the table holds it.');
  });
});

describe('a table whose definition holds every column it has', () => {
  it('reads a Prisma model the database names after itself, and passes check', () => {
    const root = billingWithATableOfItsOwn('prisma', [], PRISMA_UNMAPPED);
    const result = expectOk(cli(root, ...REMINDERS, ...PERSONAL));

    expect(result.stdout).not.toContain('could not be read');

    expect(read(root, DECLARATION)).toContain(
      "  subject: 'customer_id',\n  fields: ['customer_email', 'customer_name'],\n",
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});

const TENANT_FLAGS = ['--tenancy', 'shared-table'];

const KNEX_WITHOUT_TENANT = `  await knex.schema.withSchema(BILLING_SCHEMA).createTable('payment_reminders', (table) => {
    table.text('id').primary();
    table.text('customer_id').notNullable();
    table.text('customer_email');
    table.text('customer_name');
  });
`;

describe('a table of a project whose tables hold tenant data', () => {
  it('refuses a table without the tenant column: the erasure of the context confines every statement to a tenant', () => {
    const root = billingWithATableOfItsOwn('knex', TENANT_FLAGS, KNEX_WITHOUT_TENANT);
    const refused = failure(cli(root, ...REMINDERS, ...PERSONAL, '--json'));

    expect(refused.message).toContain('holds no column tenant_id, and the erasure of this context confines');
    expect(refused.fix).toContain('tenantColumn of the ORM package of the kit');
  });

  it('confines the erasure and the export of a table that holds it', () => {
    const table = KNEX_WITHOUT_TENANT.replace(
      "    table.text('customer_name');\n",
      "    table.text('customer_name');\n    table.text('tenant_id');\n",
    );

    const root = billingWithATableOfItsOwn('knex', TENANT_FLAGS, table);

    expectOk(cli(root, ...REMINDERS, ...PERSONAL));

    expect(read(root, `${PERSISTENCE}/knex-billing-personal-data-erasure.repository.ts`)).toContain(
      '  constructor(database: KnexContext, scope: ExecutionScope) {',
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});
