import { EntitySchema } from 'typeorm';
import { AUDIT_ARCHIVES_TABLE } from '../sql/audit-archives-table-name';
import { AUDIT_CHAINS_TABLE } from '../sql/audit-chains-table-name';
import { AUDIT_ENTRIES_TABLE } from '../sql/audit-entries-table-name';
import type { AuditEntitiesOptions } from './audit-entities-options';

const text = { type: 'text' } as const;
const optionalText = { type: 'text', nullable: true } as const;

const ENTRY_COLUMNS = {
  chain: { ...text, primary: true },
  sequence: { type: 'bigint', primary: true },
  id: { ...text, unique: true },
  occurredAt: { type: 'timestamptz', precision: 3, name: 'occurred_at' },
  category: text,
  action: text,
  outcome: text,
  reason: optionalText,
  actorId: { ...text, name: 'actor_id' },
  actorType: { ...text, name: 'actor_type' },
  actorTenantId: { ...optionalText, name: 'actor_tenant_id' },
  tenantId: { ...optionalText, name: 'tenant_id' },
  impersonatedBy: { ...optionalText, name: 'impersonated_by' },
  sessionId: { ...optionalText, name: 'session_id' },
  resourceType: { ...optionalText, name: 'resource_type' },
  resourceId: { ...optionalText, name: 'resource_id' },
  context: optionalText,
  correlationId: { ...text, name: 'correlation_id' },
  causationId: { ...optionalText, name: 'causation_id' },
  origin: text,
  changes: { type: 'jsonb', nullable: true },
  extensions: { type: 'jsonb', default: () => "'{}'::jsonb" },
  previousHash: { ...text, name: 'previous_hash' },
  hash: text,
} as const;

const ENTRY_INDICES = [
  { name: 'audit_entries_occurred_idx', columns: ['occurredAt', 'chain', 'sequence'] },
  { name: 'audit_entries_actor_idx', columns: ['actorId', 'occurredAt'] },
  { name: 'audit_entries_resource_idx', columns: ['resourceType', 'resourceId'] },
  { name: 'audit_entries_correlation_idx', columns: ['correlationId'] },
];

const ARCHIVE_COLUMNS = {
  chain: { ...text, primary: true },
  fromSequence: { type: 'bigint', name: 'from_sequence' },
  toSequence: { type: 'bigint', name: 'to_sequence', primary: true },
  lastHash: { ...text, name: 'last_hash' },
  entries: { type: 'integer' },
  fileKey: { ...text, name: 'file_key' },
  fileDigest: { ...text, name: 'file_digest' },
  archivedAt: { type: 'timestamptz', precision: 3, name: 'archived_at' },
} as const;

/**
 * The three tables of the trail (the entries, the heads of the chains, the archives) as TypeORM entities, to register with the data source so that the
 * migrations of the project create them, with the columns, the keys and the indexes the SQL of
 * the package gives them. The guard that keeps the entries append-only is no entity: paste
 * `auditGuardStatements` in a migration of your own after the one that creates the tables.
 */
export function auditEntities(options: AuditEntitiesOptions = {}): readonly EntitySchema[] {
  const schema = options.schema === undefined ? {} : { schema: options.schema };

  return [
    new EntitySchema({
      name: 'AuditEntry',
      tableName: AUDIT_ENTRIES_TABLE,
      ...schema,
      columns: ENTRY_COLUMNS,
      indices: ENTRY_INDICES,
    }),
    new EntitySchema({
      name: 'AuditChain',
      tableName: AUDIT_CHAINS_TABLE,
      ...schema,
      columns: { chain: { ...text, primary: true }, sequence: { type: 'bigint' }, hash: text },
    }),
    new EntitySchema({ name: 'AuditArchive', tableName: AUDIT_ARCHIVES_TABLE, ...schema, columns: ARCHIVE_COLUMNS }),
  ];
}
