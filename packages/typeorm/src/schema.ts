import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
import type { OutboxStatus } from '@ddd-ts-kit/events';

export { schemaNameOf } from '@ddd-ts-kit/kernel';

/** The column types differ per database family; pick the one of the data source. */
export type TypeOrmDialect = 'postgres' | 'mysql' | 'sqlite';

export interface EntityOptions {
  /**
   * The schema (PostgreSQL) or database (MySQL) holding the table. Without it the table lives
   * in the default schema of the connection.
   */
  readonly schema?: string;
  /** Default `postgres`. */
  readonly dialect?: TypeOrmDialect;
  /** Default `outbox` or `processed_events`. */
  readonly tableName?: string;
  /**
   * The entity name, unique in a data source. Default `OutboxRecord` or `ProcessedEvent`,
   * suffixed with the schema when one is given, so each context gets an entity of its own.
   */
  readonly name?: string;
}

export interface OutboxRow {
  id: string;
  /** Insertion order, the tie-breaker of the claim. A bigint, which drivers return as a string. */
  sequence: string | number;
  type: string;
  version: number;
  occurredAt: string;
  payload: unknown;
  traceparent: string | null;
  correlationId: string | null;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastErrorCode: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface ProcessedEventRow {
  consumer: string;
  eventId: string;
  processedAt: Date;
}

// Key columns are bounded strings because MySQL cannot index unbounded text.
const KEY_LENGTH = 191;

const INSTANT: Record<TypeOrmDialect, EntitySchemaColumnOptions> = {
  postgres: { type: 'timestamp with time zone', precision: 3 },
  mysql: { type: 'datetime', precision: 3 },
  sqlite: { type: 'datetime' },
};

// An explicit default rather than `createDate`, whose precision TypeORM does not align with
// the column's on MySQL.
const RIGHT_NOW: Record<TypeOrmDialect, () => string> = {
  postgres: () => 'now()',
  mysql: () => 'CURRENT_TIMESTAMP(3)',
  sqlite: () => 'CURRENT_TIMESTAMP',
};

const JSON_DOCUMENT: Record<TypeOrmDialect, EntitySchemaColumnOptions> = {
  postgres: { type: 'jsonb' },
  mysql: { type: 'json' },
  sqlite: { type: 'simple-json' },
};

/**
 * The four audit columns, to spread into the `columns` of an `EntitySchema`. Their properties
 * are those of the kernel `AuditStamp`, so `stampCreation(scope, clock)` spreads into an insert
 * as it is, and their names (`created_at`, `created_by`, `updated_at`, `updated_by`) are the
 * same in every project.
 */
export function auditColumns(
  dialect: TypeOrmDialect = 'postgres',
): Record<keyof AuditStamp, EntitySchemaColumnOptions> {
  const instant = INSTANT[dialect];
  return {
    createdAt: { ...instant, name: 'created_at' },
    createdBy: { name: 'created_by', type: 'varchar', length: KEY_LENGTH },
    updatedAt: { ...instant, name: 'updated_at' },
    updatedBy: { name: 'updated_by', type: 'varchar', length: KEY_LENGTH },
  };
}

/** The tenant column, `tenant_id`, under the property of the kernel `TenantScoped`. */
export function tenantColumn(): Record<keyof TenantScoped, EntitySchemaColumnOptions> {
  return { tenantId: { name: 'tenant_id', type: 'varchar', length: KEY_LENGTH } };
}

/**
 * The outbox table as an `EntitySchema`: add it to the `entities` of the data source and
 * `typeorm migration:generate` creates it in a migration of the consuming project. No
 * decorator, so no `reflect-metadata` import and no decorator compiler option is needed.
 */
export function outboxEntity(options: EntityOptions = {}): EntitySchema<OutboxRow> {
  const dialect = options.dialect ?? 'postgres';
  const instant = INSTANT[dialect];
  const tableName = options.tableName ?? 'outbox';
  return new EntitySchema<OutboxRow>({
    name: entityName('OutboxRecord', options),
    tableName,
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    columns: {
      ...keyColumns(dialect),
      type: { type: 'text' },
      version: { type: 'int' },
      // Text, not a timestamp: the envelope must come back exactly as published, offset included.
      occurredAt: { name: 'occurred_at', type: 'text' },
      // Nullable because JSON `null` is a legal payload and is stored as SQL NULL.
      payload: { ...JSON_DOCUMENT[dialect], nullable: true },
      traceparent: { type: 'text', nullable: true },
      correlationId: { name: 'correlation_id', type: 'text', nullable: true },
      status: { type: 'varchar', length: 16, default: 'pending' },
      attempts: { type: 'int', default: 0 },
      nextAttemptAt: { ...instant, name: 'next_attempt_at' },
      lastErrorCode: { name: 'last_error_code', type: 'text', nullable: true },
      publishedAt: { ...instant, name: 'published_at', nullable: true },
      createdAt: { ...instant, name: 'created_at', default: RIGHT_NOW[dialect] },
    },
    indices: [pendingIndex(tableName, dialect)],
  });
}

function entityName(base: string, options: EntityOptions): string {
  return options.name ?? (options.schema === undefined ? base : `${base}_${options.schema}`);
}

type OutboxSchemaOptions = EntitySchema<OutboxRow>['options'];

function keyColumns(dialect: TypeOrmDialect): Pick<OutboxSchemaOptions['columns'], 'id' | 'sequence'> {
  if (dialect === 'sqlite') {
    // SQLite only auto-increments an integer primary key, so the roles are swapped there.
    return {
      id: { type: 'varchar', length: KEY_LENGTH, unique: true },
      sequence: { type: 'integer', primary: true, generated: 'increment' },
    };
  }
  return {
    id: { type: 'varchar', length: KEY_LENGTH, primary: true },
    // MySQL requires an auto-increment column to be a key.
    sequence: { type: 'bigint', generated: 'increment', unique: dialect === 'mysql' },
  };
}

function pendingIndex(
  tableName: string,
  dialect: TypeOrmDialect,
): NonNullable<OutboxSchemaOptions['indices']>[number] {
  if (dialect === 'mysql') {
    // No partial index in MySQL: the status leads the index instead.
    return { name: `${tableName}_pending_idx`, columns: ['status', 'nextAttemptAt', 'sequence'] };
  }
  // Partial: the relay only ever scans what is pending, and published rows dominate.
  return {
    name: `${tableName}_pending_idx`,
    columns: ['nextAttemptAt', 'sequence'],
    where: "status = 'pending'",
  };
}

/** The idempotency table of the consumers, to register and migrate like the outbox. */
export function processedEventEntity(options: EntityOptions = {}): EntitySchema<ProcessedEventRow> {
  const dialect = options.dialect ?? 'postgres';
  return new EntitySchema<ProcessedEventRow>({
    name: entityName('ProcessedEvent', options),
    tableName: options.tableName ?? 'processed_events',
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    columns: {
      // The primary key is the unique (consumer, event_id) the store relies on.
      consumer: { type: 'varchar', length: KEY_LENGTH, primary: true },
      eventId: { name: 'event_id', type: 'varchar', length: KEY_LENGTH, primary: true },
      processedAt: { ...INSTANT[dialect], name: 'processed_at', default: RIGHT_NOW[dialect] },
    },
  });
}
