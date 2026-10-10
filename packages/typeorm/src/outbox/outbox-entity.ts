import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';
import { RIGHT_NOW } from '../columns/right-now.js';
import type { TypeOrmDialect } from '../columns/type-orm-dialect.js';
import { entityName } from './entity-name.js';
import type { EntityOptions } from './entity-options.js';
import type { OutboxRow } from './outbox-row.js';

const JSON_DOCUMENT: Record<TypeOrmDialect, EntitySchemaColumnOptions> = {
  postgres: { type: 'jsonb' },
  mysql: { type: 'json' },
  sqlite: { type: 'simple-json' },
};

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

type OutboxSchemaOptions = EntitySchema<OutboxRow>['options'];

function keyColumns(dialect: TypeOrmDialect): Pick<OutboxSchemaOptions['columns'], 'id' | 'sequence'> {
  if (dialect === 'sqlite') {
    // SQLite only auto-increments an integer primary key, so the roles are swapped there.
    return {
      id: { type: 'varchar', length: INDEXABLE_LENGTH, unique: true },
      sequence: { type: 'integer', primary: true, generated: 'increment' },
    };
  }

  return {
    id: { type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
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
