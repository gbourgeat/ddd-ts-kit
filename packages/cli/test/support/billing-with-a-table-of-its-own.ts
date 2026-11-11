import { cli, read, write } from '../helpers';
import { expectOk } from './expect-ok';
import { initProject } from './init-project';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';

/** `payment_reminders`, a table no aggregate owns, as a developer writes it in the schema of billing on each ORM. */
const TABLES: Readonly<Record<string, string>> = {
  drizzle: `export const paymentReminders = billingSchema.table('payment_reminders', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),
  endedAt: text('ended_at'),
});
`,
  knex: `  await knex.schema.withSchema(BILLING_SCHEMA).createTable('payment_reminders', (table) => {
    table.text('id').primary();
    table.text('customer_id').notNullable();
    table.text('customer_email');
    table.text('customer_name');
    table.text('ended_at');
  });
`,
  typeorm: `interface PaymentReminderRow {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  endedAt: string | null;
}

export const paymentReminders = new EntitySchema<PaymentReminderRow>({
  name: 'BillingPaymentReminder',
  tableName: 'payment_reminders',
  schema: BILLING_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    customerId: { name: 'customer_id', type: 'text' },
    customerEmail: { name: 'customer_email', type: 'text', nullable: true },
    customerName: { name: 'customer_name', type: 'text', nullable: true },
    endedAt: { name: 'ended_at', type: 'text', nullable: true },
  },
});
`,
  prisma: `model BillingPaymentReminder {
  id            String  @id
  customerId    String  @map("customer_id")
  customerEmail String? @map("customer_email")
  customerName  String? @map("customer_name")
  endedAt       String? @map("ended_at")

  @@map("payment_reminders")
  @@schema("billing")
}
`,
};

/** The marker of the schema file each ORM reads, which the table is written above. */
const MARKERS: Readonly<Record<string, string>> = {
  drizzle: '// /ddd-ts-kit:tables',
  knex: '  // /ddd-ts-kit:tables',
  typeorm: '// /ddd-ts-kit:tables',
  prisma: '// /ddd-ts-kit:models',
};

const GLOSSARY = [
  '--purpose',
  'Bills customers for what they bought.',
  '--term',
  'Invoice=A request for payment sent to a customer',
];

/** The schema file of billing on an ORM: where its tables are declared. */
export function billingSchemaFile(orm: string): string {
  if (orm === 'prisma') {
    return 'prisma/schema/billing.prisma';
  }

  return `${PERSISTENCE}/${orm === 'knex' ? 'create-billing-tables' : 'billing'}.schema.ts`;
}

/**
 * A project of the given ORM with a billing context, its Invoice aggregate and repository, and a
 * table of its own written by hand in the schema, `payment_reminders`, which no aggregate owns;
 * `table` gives another definition of it.
 */
export function billingWithATableOfItsOwn(orm: string, flags: readonly string[] = [], table = TABLES[orm]): string {
  const root = initProject('--orm', orm, ...flags);

  expectOk(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...GLOSSARY));
  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));
  expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice'));

  const file = billingSchemaFile(orm);
  const marker = MARKERS[orm] ?? '';

  write(root, file, read(root, file).replace(marker, `${table ?? ''}${marker}`));

  return root;
}
