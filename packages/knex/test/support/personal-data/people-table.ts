import type { Knex } from 'knex';
import type { TenantTableTarget } from '../../../src';

/** The rows of a context about persons, as a repository or a projection writes them: one row per person and per `n`. */
export interface PersonRow {
  readonly id: string;
  readonly person_id: string;
  readonly display_name: string;
  readonly email: string;
  readonly age: number | null;
  readonly avatar_key: string | null;
  readonly tenant_id: string;
  readonly registered_at: Date;
  /** When the relation with the person ended: what a retention runs from; empty while it lasts. */
  readonly ended_at: Date | null;
}

export const PRIVACY = 'privacy';
export const PEOPLE: TenantTableTarget = { schema: PRIVACY, table: 'people' };
export const PEOPLE_PATH = `${PRIVACY}.people`;
/** The same table, its `age` not nullable: what a pseudonymisation cannot write to. */
export const PEOPLE_STRICT: TenantTableTarget = { schema: PRIVACY, table: 'people_strict' };
export const PEOPLE_STRICT_PATH = `${PRIVACY}.people_strict`;

/** What the migration of the table would contain: three personal columns of two types, a file column, the tenant. */
export async function createPeopleTable(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(PRIVACY);

  for (const [table, strict] of [
    ['people', false],
    ['people_strict', true],
  ] as const) {
    await knex.schema.withSchema(PRIVACY).createTable(table, (columns) => {
      columns.text('id').primary();
      columns.text('person_id').notNullable();
      columns.text('display_name').notNullable();
      columns.text('email').notNullable();
      // A personal column that is not a text has to accept null: pseudonymised, it reads nothing.
      void (strict ? columns.integer('age').notNullable() : columns.integer('age'));
      columns.text('avatar_key');
      columns.text('tenant_id').notNullable();
      columns.timestamp('registered_at', { useTz: true }).notNullable();
      columns.timestamp('ended_at', { useTz: true });
    });
  }
}

export function aPersonRow(subject: string, n: number, tenant = 'acme'): PersonRow {
  return {
    id: `${tenant}:${subject}-${String(n)}`,
    person_id: subject,
    display_name: `${subject} ${String(n)}`,
    email: `${subject}-${String(n)}@example.org`,
    age: 30 + n,
    avatar_key: `tenants/${tenant}/avatars/${subject}-${String(n)}`,
    tenant_id: tenant,
    registered_at: new Date('2026-01-01T00:00:00.000Z'),
    ended_at: null,
  };
}
