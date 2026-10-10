// ddd-ts-kit:imports
import type { Knex } from 'knex';
import { IDENTITY_SCHEMA } from './identity.schema.js';
import { auditColumns } from '@ddd-ts-kit/knex';
// /ddd-ts-kit:imports

export async function createIdentityTables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(IDENTITY_SCHEMA);
  // ddd-ts-kit:tables
  await createPersonTable(knex);
  await createPracticeTable(knex);
  await createDelegationTable(knex);
  // /ddd-ts-kit:tables
}

// ddd-ts-kit:definitions
function createPersonTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(IDENTITY_SCHEMA).createTable('persons', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('display_name').notNullable();
    table.text('email').notNullable();
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

function createPracticeTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(IDENTITY_SCHEMA).createTable('practices', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('name').notNullable();
    table.text('time_zone').notNullable();
    table.jsonb('members').notNullable();
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

function createDelegationTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(IDENTITY_SCHEMA).createTable('delegations', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('practice_id').notNullable();
    table.text('practitioner_id').notNullable();
    table.text('assistant_id').notNullable();
    table.boolean('availability_included').notNullable();
    table.timestamp('ends_at', { useTz: true });
    table.timestamp('ended_at', { useTz: true });
    table.text('end_cause');
    table.index(['practice_id', 'practitioner_id', 'assistant_id']);
    table.index(['ends_at']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}
// /ddd-ts-kit:definitions
