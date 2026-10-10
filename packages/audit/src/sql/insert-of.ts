import type { AuditEntry } from '@ddd-ts-kit/kernel';
import { identifier, joined, sql, type Sql } from './sql.js';

const COLUMNS = [
  'id',
  'chain',
  'sequence',
  'occurred_at',
  'category',
  'action',
  'outcome',
  'reason',
  'actor_id',
  'actor_type',
  'actor_tenant_id',
  'tenant_id',
  'impersonated_by',
  'session_id',
  'resource_type',
  'resource_id',
  'context',
  'correlation_id',
  'causation_id',
  'origin',
  'changes',
  'extensions',
  'previous_hash',
  'hash',
] as const;

export function insertOf(entries: Sql, entry: AuditEntry): Sql {
  const columns = joined(
    COLUMNS.map((column) => identifier(column)),
    ', ',
  );

  return sql`insert into ${entries} (${columns}) values (${joined(valuesOf(entry), ', ')})`;
}

function valuesOf(entry: AuditEntry): Sql[] {
  const { actor, resource } = entry;

  return [
    sql`${entry.id}, ${entry.chain}, ${entry.sequence}, ${entry.occurredAt.toISOString()}::timestamptz`,
    sql`${entry.category}, ${entry.action}, ${entry.outcome}, ${orNull(entry.reason)}`,
    sql`${actor.id}, ${actor.type}, ${orNull(actor.tenantId)}, ${orNull(entry.tenantId)}`,
    sql`${orNull(entry.impersonatedBy)}, ${orNull(entry.sessionId)}`,
    sql`${orNull(resource?.type)}, ${orNull(resource?.id)}, ${orNull(entry.context)}`,
    sql`${entry.correlationId}, ${orNull(entry.causationId)}, ${entry.origin}`,
    sql`${jsonOrNull(entry.changes)}::jsonb, ${JSON.stringify(entry.extensions)}::jsonb`,
    sql`${entry.previousHash}, ${entry.hash}`,
  ];
}

function orNull(value: string | undefined): string | null {
  return value ?? null;
}

function jsonOrNull(value: object | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}
