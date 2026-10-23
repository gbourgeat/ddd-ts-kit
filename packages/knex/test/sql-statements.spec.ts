import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { dialectOf } from '../src/sql/dialect-of';
import { tenantIsolationStatements } from '../src/tenancy/tenant-isolation-statements';

describe('the SQL the adapter writes, without a database', () => {
  it('reads the dialect from the name knex gives it, whatever the driver, and calls any other one other', () => {
    const dialects = ['pg', 'mysql2', 'better-sqlite3', 'mssql'].map((client) =>
      dialectOf(knex({ client, useNullAsDefault: true })),
    );

    expect(dialects).toEqual(['postgres', 'mysql', 'sqlite', 'other']);
  });

  it('names a table of the default schema without a schema in its row-level security', () => {
    const [enabled, forced] = tenantIsolationStatements({ table: 'invoices' });

    expect([enabled, forced]).toEqual([
      'alter table "invoices" enable row level security',
      'alter table "invoices" force row level security',
    ]);
  });
});
