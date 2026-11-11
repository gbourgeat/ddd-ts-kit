import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { bin, findingsOf } from './e2e/run-in';
import { cli, exists, read } from './helpers';
import { failure } from './reports';
import { billingSchemaFile, billingWithATableOfItsOwn } from './support/billing-with-a-table-of-its-own';
import { expectOk } from './support/expect-ok';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const DECLARATION = `${PERSISTENCE}/payment-reminders.personal-fields.ts`;
const SPEC = `${BILLING}/test/integration/billing-personal-data.spec.ts`;
const COPIES = 'src/platform/privacy/data-subject-copies.ts';
const REMINDERS = ['generate', 'personal-fields', 'billing', 'payment_reminders'];
const PERSONAL = ['--personal', 'customer_email,customer_name', '--subject', 'customer_id'];
const ORMS = ['drizzle', 'knex', 'typeorm', 'prisma'];

const PREFIXES: Readonly<Record<string, string>> = {
  drizzle: 'drizzle',
  knex: 'knex',
  typeorm: 'type-orm',
  prisma: 'prisma',
};

function adapterOf(root: string, orm: string, port = 'erasure'): string {
  return read(root, `${PERSISTENCE}/${PREFIXES[orm] ?? ''}-billing-personal-data-${port}.repository.ts`);
}

describe.each(ORMS)(
  'generate personal-fields declares the personal columns of a table no aggregate owns, on %s',
  (orm) => {
    it('writes the declaration and the erasure of the context, leaves the table as it was, and passes check and the formatter', () => {
      const root = billingWithATableOfItsOwn(orm);
      const schema = read(root, billingSchemaFile(orm));
      const result = expectOk(cli(root, ...REMINDERS, ...PERSONAL));

      expect(read(root, billingSchemaFile(orm))).toBe(schema);
      expect(read(root, DECLARATION)).toContain('export const PaymentRemindersPersonalFields = personalFields(');
      expect(read(root, DECLARATION)).toContain("  erasure: 'pseudonymise',\n};");
      expect(adapterOf(root, orm)).toContain('        PaymentRemindersPersonalFields,\n');
      expect(adapterOf(root, orm, 'export')).toContain('        PaymentRemindersPersonalFields,\n');
      expect(read(root, COPIES)).toContain('  BillingPersonalDataErasure,\n');
      expect(exists(root, `${BILLING}/test/fakes/billing-personal-data-export.fake.ts`)).toBe(true);
      expect(result.stdout).toContain('names as it.todo each case to prove on the test database');
      expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
      expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=50', '.'] })).toBe('');
    });

    it('refuses a table the schema of the context does not declare, a column the table does not hold, and a second declaration', () => {
      const root = billingWithATableOfItsOwn(orm);
      const unknown = failure(cli(root, 'generate', 'personal-fields', 'billing', 'reminders', ...PERSONAL, '--json'));

      const absent = failure(
        cli(root, ...REMINDERS, '--personal', 'customer_phone', '--subject', 'customer_id', '--json'),
      );

      expect(unknown.message).toBe(`The schema of billing (${billingSchemaFile(orm)}) declares no table "reminders".`);
      expect(unknown.fix).toContain('name one the schema declares (invoices, payment_reminders)');

      expect(absent.message).toBe(
        `The table payment_reminders of ${billingSchemaFile(orm)} holds no column customer_phone.`,
      );

      expect(absent.fix).toContain('(id, customer_id, customer_email, customer_name, ended_at)');
      expect(exists(root, DECLARATION)).toBe(false);

      expectOk(cli(root, ...REMINDERS, ...PERSONAL));

      const again = failure(
        cli(root, ...REMINDERS, '--personal', 'customer_name', '--subject', 'customer_id', '--json'),
      );

      expect(again.message).toBe(`${DECLARATION} already declares what the table payment_reminders keeps of a person.`);
      expect(again.fix).toContain('add the column to its `fields` there');
    });
  },
);

describe('the declaration of a table, as the erasure of each ORM reads it', () => {
  it('names the table and the columns as the schema of the project spells them', () => {
    const [drizzle, knex, typeorm, prisma] = ORMS.map((orm) => {
      const root = billingWithATableOfItsOwn(orm);

      expectOk(cli(root, ...REMINDERS, ...PERSONAL, '--erasure', 'row', '--retention', 'ended_at:36m'));

      return read(root, DECLARATION);
    });

    expect(drizzle).toContain('type PaymentRemindersRow = typeof paymentReminders.$inferSelect;');

    expect(drizzle).toContain(
      "  subject: 'customerId',\n  fields: ['customerEmail', 'customerName'],\n  erasure: 'row',\n",
    );

    expect(drizzle).toContain("  retention: { after: 'endedAt', months: 36 },");
    expect(drizzle).toContain('// TODO(domain): what writes payment_reminders writes in ended_at the date');
    expect(drizzle).not.toContain('mapper');
    expect(drizzle).toContain('personalFields(paymentReminders, declaration);');

    expect(knex).toContain("const TABLE = { schema: BILLING_SCHEMA, table: 'payment_reminders' };");
    expect(knex).toContain('const declaration: PersonalFieldsOptions<Record<string, unknown>> = {');
    expect(knex).toContain("  subject: 'customer_id',\n  fields: ['customer_email', 'customer_name'],\n");
    expect(knex).not.toContain('-row.schema');

    expect(typeorm).toContain("import type { EntitySchema } from 'typeorm';");

    expect(typeorm).toContain(
      'type PaymentRemindersRow = typeof paymentReminders extends EntitySchema<infer Row> ? Row : never;',
    );

    expect(typeorm).toContain("  subject: 'customerId',\n  fields: ['customerEmail', 'customerName'],\n");

    expect(prisma).toContain("const TABLE: PrismaPersonalTable = { schema: 'billing', table: 'payment_reminders' };");
    expect(prisma).toContain("  retention: { after: 'ended_at', months: 36 },");
  });

  it('names in the spec of the context each case to prove, as it.todo, and proves the fakes', () => {
    const plain = billingWithATableOfItsOwn('knex');
    const retained = billingWithATableOfItsOwn('knex');

    expectOk(cli(plain, ...REMINDERS, ...PERSONAL));
    expectOk(cli(retained, ...REMINDERS, ...PERSONAL, '--retention', 'ended_at:36m'));

    const spec = read(plain, SPEC);

    expect(spec).toContain("describe('KnexBillingPersonalDataErasure, on payment_reminders', () => {");

    expect(spec).toContain(
      "  it.todo('erases what the table keeps of the subject, as the declaration says, and leaves the others');",
    );

    expect(spec).toContain(
      "  it.todo('hands over the columns of the subject as plain data, under its source, and nothing of the others');",
    );

    expect(spec).toContain("const SOURCE = 'billing.payment_reminders';");
    expect(spec).toContain("const fake = new FakeBillingPersonalDataErasure().holds('ada', 2);");
    expect(spec).not.toContain('retention');

    expect(read(retained, SPEC)).toContain(
      "  it.todo('erases the rows whose retention ended, as the declaration says, and leaves the others');",
    );
  });
});
