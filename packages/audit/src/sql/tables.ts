import { identifier, type Sql } from './statement.js';

export const AUDIT_ENTRIES_TABLE = 'audit_entries';
export const AUDIT_CHAINS_TABLE = 'audit_chains';

export interface AuditTablesOptions {
  /** The schema holding the tables. Without it they live in the default schema of the connection. */
  readonly schema?: string;
}

export interface AuditTables {
  readonly entries: Sql;
  readonly chains: Sql;
}

export function auditTables({ schema }: AuditTablesOptions = {}): AuditTables {
  return { entries: qualified(schema, AUDIT_ENTRIES_TABLE), chains: qualified(schema, AUDIT_CHAINS_TABLE) };
}

function qualified(schema: string | undefined, name: string): Sql {
  return schema === undefined ? identifier(name) : identifier(schema, name);
}

/**
 * The tables of the trail on PostgreSQL, one statement per element: `audit_entries`, the
 * chain heads that serialize the appends, the indexes of the reader, then the guard.
 */
export function auditTablesSql(options: AuditTablesOptions = {}): string[] {
  const entries = named(options.schema, AUDIT_ENTRIES_TABLE);
  return [
    ...(options.schema === undefined ? [] : [`create schema if not exists ${named(undefined, options.schema)}`]),
    `create table ${named(options.schema, AUDIT_CHAINS_TABLE)} ("chain" text primary key, "sequence" bigint not null, "hash" text not null)`,
    `create table ${entries} (${ENTRY_COLUMNS.join(', ')}, primary key ("chain", "sequence"))`,
    `create index "audit_entries_occurred_idx" on ${entries} ("occurred_at", "chain", "sequence")`,
    `create index "audit_entries_actor_idx" on ${entries} ("actor_id", "occurred_at")`,
    `create index "audit_entries_resource_idx" on ${entries} ("resource_type", "resource_id")`,
    `create index "audit_entries_correlation_idx" on ${entries} ("correlation_id")`,
    ...auditGuardSql(options),
  ];
}

function named(schema: string | undefined, name: string): string {
  return qualified(schema, name).strings.join('');
}

const ENTRY_COLUMNS = [
  '"id" text not null unique',
  '"chain" text not null',
  '"sequence" bigint not null',
  '"occurred_at" timestamptz(3) not null',
  '"category" text not null',
  '"action" text not null',
  '"outcome" text not null',
  '"reason" text',
  '"actor_id" text not null',
  '"actor_type" text not null',
  '"actor_tenant_id" text',
  '"tenant_id" text',
  '"impersonated_by" text',
  '"session_id" text',
  '"resource_type" text',
  '"resource_id" text',
  '"context" text',
  '"correlation_id" text not null',
  '"causation_id" text',
  '"origin" text not null',
  '"changes" jsonb',
  `"extensions" jsonb not null default '{}'::jsonb`,
  '"previous_hash" text not null',
  '"hash" text not null',
];

/**
 * The guard of `audit_entries`: triggers that refuse UPDATE, DELETE and TRUNCATE, whoever
 * asks. A role that owns the table can still drop them: see the README for the privileges to
 * revoke and for anchoring.
 */
export function auditGuardSql(options: AuditTablesOptions = {}): string[] {
  const entries = named(options.schema, AUDIT_ENTRIES_TABLE);
  const guard = named(options.schema, 'audit_entries_append_only');
  return [
    `create function ${guard}() returns trigger language plpgsql as $guard$ begin raise exception 'audit entries are append-only: % refused', tg_op using errcode = 'restrict_violation'; end $guard$`,
    `create trigger "audit_entries_no_rewrite" before update or delete on ${entries} for each row execute function ${guard}()`,
    `create trigger "audit_entries_no_truncate" before truncate on ${entries} for each statement execute function ${guard}()`,
  ];
}

/** The `down` of `auditTablesSql`. The schema itself is left in place. */
export function dropAuditTablesSql(options: AuditTablesOptions = {}): string[] {
  return [
    `drop table if exists ${named(options.schema, AUDIT_ENTRIES_TABLE)}`,
    `drop table if exists ${named(options.schema, AUDIT_CHAINS_TABLE)}`,
    `drop function if exists ${named(options.schema, 'audit_entries_append_only')}()`,
  ];
}
