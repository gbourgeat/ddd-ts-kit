import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { expectOk } from './support/expect-ok';
import { billingProject, PERSISTENCE } from './support/read-model-project';

const SCHEMA = `${PERSISTENCE}/billing.schema.ts`;

/** `generate read-model billing Dues` with these fields, then the file that declares its table. */
function tablesOf(orm: string, file: string, ...fields: readonly string[]): string {
  const root = billingProject('--orm', orm);

  expectOk(cli(root, 'generate', 'read-model', 'billing', 'Dues', ...fields.flatMap((field) => ['--field', field])));

  return read(root, file);
}

describe('the check that keeps the live rows of a read model whole', () => {
  it('fits on one line with the table when the row requires little, on Drizzle and on Knex', () => {
    expect(tablesOf('drizzle', SCHEMA, 'dueAt:instant')).toContain(
      "    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }),\n    ...readModelColumns(),\n  },\n  (table) => [check('dues_live_rows_whole', sql`${table.deleted} or (${table.dueAt} is not null)`)],\n);",
    );

    expect(tablesOf('knex', `${PERSISTENCE}/create-billing-tables.schema.ts`, 'dueAt:instant')).toContain(
      "    readModelColumns(table);\n    table.check('deleted or (due_at is not null)', {}, 'dues_live_rows_whole');\n  });",
    );
  });

  it('names only the fields the row requires: one that may hold null is left out', () => {
    expect(tablesOf('typeorm', SCHEMA, 'dueAt:instant', 'paidAt:instant:nullable')).toContain(
      '  checks: [\n    {\n      name: \'dues_live_rows_whole\',\n      expression: \'"deleted" or ("due_at" is not null)\',\n    },\n  ],',
    );
  });

  it('is not written for a row that requires nothing beside its key', () => {
    const drizzle = tablesOf('drizzle', SCHEMA, 'paidAt:instant:nullable');

    expect(drizzle).toContain(
      "export const dues = billingSchema.table('dues', {\n  id: text('id').primaryKey(),\n  paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),\n  ...readModelColumns(),\n});",
    );

    expect(drizzle).not.toContain('check');
    expect(tablesOf('knex', `${PERSISTENCE}/create-billing-tables.schema.ts`)).not.toContain('table.check(');
    expect(tablesOf('typeorm', SCHEMA, 'paidAt:instant:nullable')).not.toContain('checks:');
    expect(tablesOf('prisma', 'prisma/schema/billing.prisma', 'paidAt:instant:nullable')).not.toContain('TODO(domain)');
  });

  it('is left to the migration on Prisma, whose schema language has none: the statement is written out', () => {
    expect(tablesOf('prisma', 'prisma/schema/billing.prisma', 'dueAt:instant')).toContain(
      'ALTER TABLE "billing"."dues" ADD CONSTRAINT "dues_live_rows_whole" CHECK ("deleted" OR ("due_at" IS NOT NULL));\n',
    );
  });
});
