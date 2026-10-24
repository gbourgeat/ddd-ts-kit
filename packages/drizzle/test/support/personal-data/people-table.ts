import { integer, pgSchema, text } from 'drizzle-orm/pg-core';
import { instant } from '../../../src/postgres/columns/instant';

/** The rows of a context about persons: three personal columns of two types, a file column, the tenant. A personal column that is not a text accepts null: pseudonymised, it reads nothing. */
export const people = pgSchema('privacy').table('people', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  avatarKey: text('avatar_key'),
  tenantId: text('tenant_id').notNull(),
  registeredAt: instant('registered_at').notNull(),
  endedAt: instant('ended_at'),
});

/** The same table, its `age` not nullable: what a pseudonymisation cannot write to. */
export const peopleStrict = pgSchema('privacy').table('people_strict', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  age: integer('age').notNull(),
  avatarKey: text('avatar_key'),
  tenantId: text('tenant_id').notNull(),
  registeredAt: instant('registered_at').notNull(),
  endedAt: instant('ended_at'),
});

export type PersonRow = typeof people.$inferSelect;

export function aPersonRow(subject: string, n: number, tenant = 'acme'): PersonRow {
  return {
    id: `${tenant}:${subject}-${String(n)}`,
    personId: subject,
    displayName: `${subject} ${String(n)}`,
    email: `${subject}-${String(n)}@example.org`,
    age: 30 + n,
    avatarKey: `tenants/${tenant}/avatars/${subject}-${String(n)}`,
    tenantId: tenant,
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: null,
  };
}
