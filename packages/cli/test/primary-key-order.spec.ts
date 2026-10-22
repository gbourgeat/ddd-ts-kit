import { describe, expect, it } from 'vitest';
import { primaryKeyOrderFindings } from '../src/migration';
import { sqlStatements } from '../src/migration/sql-statements';

const BREAK = '--> statement-breakpoint';

/** A migration as drizzle-kit writes it: one statement per line, separated by its breakpoint comment. */
function migration(...statements: readonly string[]): string {
  return statements.join(`${BREAK}\n`);
}

describe('the statements of a migration', () => {
  it('splits on the semicolons outside strings, quoted names, comments and dollar-quoted bodies, with the line each starts on', () => {
    const sql = [
      '-- a comment; not a statement',
      'CREATE TABLE "a;b" (note text DEFAULT \'x;y\');--> statement-breakpoint',
      '',
      'DO $$ BEGIN',
      '  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_fk" FOREIGN KEY ("customer") REFERENCES "customers"("id");',
      'EXCEPTION WHEN duplicate_object THEN null; END $$;',
      '/* a block',
      '   comment */ ALTER TABLE "invoices"   DROP COLUMN "note"',
    ].join('\n');

    expect(sqlStatements(sql).map(({ line, text }) => [line, text.slice(0, 30)])).toEqual([
      [2, 'CREATE TABLE "a;b" (note text '],
      [4, 'DO $$ BEGIN ALTER TABLE "invoi'],
      [8, 'ALTER TABLE "invoices" DROP CO'],
    ]);
  });
});

describe('a primary key changed in an order that fails on PostgreSQL', () => {
  it('reports the new key of a table added before the old one is dropped, with both statements and the fix', () => {
    const sql = migration(
      'ALTER TABLE "billing"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_position_pk" PRIMARY KEY("invoice_id","position");',
      'ALTER TABLE "billing"."invoice_lines" DROP CONSTRAINT "invoice_lines_invoice_id_line_number_pk";',
    );

    const [finding, ...others] = primaryKeyOrderFindings(sql);

    expect(others).toEqual([]);
    expect(finding?.table).toBe('invoice_lines');
    expect(finding?.early.line).toBe(1);
    expect(finding?.early.text).toContain('PRIMARY KEY("invoice_id","position")');
    expect(finding?.drop.line).toBe(2);
    expect(finding?.drop.text).toContain('DROP CONSTRAINT "invoice_lines_invoice_id_line_number_pk"');
    expect(finding?.message).toContain('PostgreSQL refuses a second primary key');
    expect(finding?.fix).toContain('move the DROP CONSTRAINT above the ADD');
    expect(finding?.fix).toContain('--custom');
  });

  it('reads ADD PRIMARY KEY and the key named by PostgreSQL, whatever the case and the blanks', () => {
    const sql = migration(
      'alter table invoices\n  add primary key ("number");',
      'ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";',
    );

    expect(primaryKeyOrderFindings(sql).map((finding) => finding.table)).toEqual(['invoices']);
  });

  it('accepts the old key dropped first, in its own statement or in the same one', () => {
    const dropFirst = migration(
      'ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";',
      'ALTER TABLE "invoices" ADD CONSTRAINT "invoices_number_pk" PRIMARY KEY("number");',
    );

    const oneStatement =
      'ALTER TABLE "invoices" ADD CONSTRAINT "invoices_number_pk" PRIMARY KEY("number"), DROP CONSTRAINT "invoices_pkey";';

    expect(primaryKeyOrderFindings(dropFirst)).toEqual([]);
    expect(primaryKeyOrderFindings(oneStatement)).toEqual([]);
  });

  it('leaves another table, a constraint that is not a key and a statement drizzle-kit left in a comment', () => {
    const sql = migration(
      'ALTER TABLE "invoices" ADD CONSTRAINT "invoices_number_pk" PRIMARY KEY("number");',
      'ALTER TABLE "payments" DROP CONSTRAINT "payments_pkey";',
      'ALTER TABLE "invoices" DROP CONSTRAINT "invoices_customer_id_customers_id_fk";',
      '-- ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";',
    );

    expect(primaryKeyOrderFindings(sql)).toEqual([]);
  });

  it('reports a column dropped before the composite key that holds it, read from the name drizzle-kit gives the key', () => {
    const sql = migration(
      'ALTER TABLE "invoice_lines" DROP COLUMN "note";',
      'ALTER TABLE "invoice_lines" DROP COLUMN "line_number";',
      'ALTER TABLE "invoice_lines" DROP CONSTRAINT "invoice_lines_invoice_id_line_number_pk";',
      'ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_position_pk" PRIMARY KEY("invoice_id","position");',
    );

    const findings = primaryKeyOrderFindings(sql);

    expect(findings.map((finding) => [finding.early.line, finding.drop.line])).toEqual([[2, 3]]);

    expect(findings[0]?.message).toContain(
      'The column "line_number" of "invoice_lines" is dropped before the primary key',
    );

    expect(findings[0]?.fix).toContain('move the DROP CONSTRAINT above the DROP COLUMN');
  });

  it('knows the columns of a key from the snapshot before the migration, where the name does not say them', () => {
    const sql = migration(
      'ALTER TABLE "invoices" DROP COLUMN "id";',
      'ALTER TABLE "invoices" DROP COLUMN "note";',
      'ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pkey";',
    );

    const known = new Map([['invoices_pkey', ['id']]]);

    expect(primaryKeyOrderFindings(sql, known).map((finding) => finding.early.line)).toEqual([1]);
    expect(primaryKeyOrderFindings(sql)).toEqual([]);
  });

  it('knows a key from the snapshot whatever its name', () => {
    const sql = migration(
      'ALTER TABLE "invoices" ADD PRIMARY KEY ("number");',
      'ALTER TABLE "invoices" DROP CONSTRAINT "invoice_identity";',
    );

    expect(primaryKeyOrderFindings(sql, new Map([['invoice_identity', ['id']]]))).toHaveLength(1);
    expect(primaryKeyOrderFindings(sql)).toEqual([]);
  });
});
