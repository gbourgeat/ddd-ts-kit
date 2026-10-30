import { describe, expect, it } from 'vitest';
import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { primaryKeyOf } from '../src/postgres';

describe('primaryKeyOf', () => {
  it('answers the column declared the primary key', () => {
    const members = pgTable('members', { id: text('id').primaryKey(), email: text('email').unique() });

    expect(primaryKeyOf(members).map((column) => column.name)).toEqual(['id']);
  });

  it('answers every column of a primary key declared on the table, the tenant of a key included', () => {
    const members = pgTable(
      'members',
      { tenantId: text('tenant_id').notNull(), id: text('id').notNull(), version: integer('version') },
      (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
    );

    expect(primaryKeyOf(members).map((column) => column.name)).toEqual(['tenant_id', 'id']);
  });

  it('refuses a table with no primary key: the first save would have no key to ignore a conflict on', () => {
    const log = pgTable('log', { line: text('line') });

    expect(() => primaryKeyOf(log)).toThrow('The table log declares no primary key');
  });
});
