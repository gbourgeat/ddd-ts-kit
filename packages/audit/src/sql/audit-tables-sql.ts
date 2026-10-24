import { AUDIT_CHAINS_TABLE } from './audit-chains-table-name';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name';
import { auditArchivesTableSql } from './audit-archives-table-sql';
import { auditGuardSql } from './audit-guard-sql';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

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
 * The tables of the trail on PostgreSQL, one statement per element: `audit_entries`, the
 * chain heads that serialize the appends, the indexes of the reader, the archives, then the guard.
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
    auditArchivesTableSql(options),
    ...auditGuardSql(options),
  ];
}
