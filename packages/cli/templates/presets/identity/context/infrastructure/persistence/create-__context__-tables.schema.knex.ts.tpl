// ddd-ts-kit:imports
import type { Knex } from 'knex';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { auditColumns } from '@ddd-ts-kit/knex';
// /ddd-ts-kit:imports

/**
 * The tables of {{context.kebab}}: what the provider authenticates stays with it, no password is stored.
{{#if tenancy.any}}
 * They hold no tenant column: the organisations are the tenants, and this context decides who
 * belongs to which ({{preset.adr}}).
{{/if}}
 */
export async function create{{context.pascal}}Tables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists({{context.constant}}_SCHEMA);
  // ddd-ts-kit:tables
  await createAccountTable(knex);
  await createOrganisationTable(knex);
  await createMemberTable(knex);
  await createInvitationTable(knex);
  await createDelegationTable(knex);
  // /ddd-ts-kit:tables
}

// ddd-ts-kit:definitions
/** Keyed by the subject the identity provider gives the person. */
function createAccountTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('accounts', (table) => {
    table.text('id').primary();
    table.text('email').notNullable();
    table.text('display_name').notNullable();
    table.text('status').notNullable();
    table.timestamp('provisioned_at', { useTz: true }).notNullable();
    table.timestamp('deactivated_at', { useTz: true });
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

/** Keyed by the slug, which is also the tenant id when the project has tenants. */
function createOrganisationTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('organisations', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('opened_by').notNullable();
    table.timestamp('opened_at', { useTz: true }).notNullable();
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

/** One current membership per account and organisation: the partial unique index is the guard. */
function createMemberTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('members', (table) => {
    table.text('id').primary();
    table.text('organisation_id').notNullable();
    table.text('account_id').notNullable();
    table.text('role').notNullable();
    table.timestamp('joined_at', { useTz: true }).notNullable();
    table.timestamp('removed_at', { useTz: true });

    table.unique(['organisation_id', 'account_id'], {
      indexName: 'members_current_idx',
      predicate: knex.whereNull('removed_at'),
    });

    table.index(['account_id']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

function createInvitationTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('invitations', (table) => {
    table.text('id').primary();
    table.text('organisation_id').notNullable();
    table.text('email').notNullable();
    table.text('role').notNullable();
    table.text('token_hash').notNullable().unique();
    table.text('invited_by').notNullable();
    table.timestamp('issued_at', { useTz: true }).notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.text('status').notNullable();
    table.timestamp('answered_at', { useTz: true });
    table.index(['organisation_id', 'status']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

function createDelegationTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema({{context.constant}}_SCHEMA).createTable('delegations', (table) => {
    table.text('id').primary();
    table.text('organisation_id').notNullable();
    table.text('delegator_id').notNullable();
    table.text('delegate_id').notNullable();
    table.text('rights').notNullable();
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).notNullable();
    table.timestamp('ended_at', { useTz: true });
    table.index(['organisation_id', 'delegate_id']);
    table.index(['organisation_id', 'delegator_id']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}
// /ddd-ts-kit:definitions
