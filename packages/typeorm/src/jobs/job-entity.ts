import { EntitySchema } from 'typeorm';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { INSTANT } from '../columns/instant';
import { entityName } from '../outbox/entity-name';
import type { JobRow } from './job-row';
import type { PostgresEntityOptions } from './postgres-entity-options';

const instant = INSTANT.postgres;

/**
 * The table of the background jobs as an `EntitySchema`, on PostgreSQL: add it to the `entities`
 * of the data source and `typeorm migration:generate` creates it in a migration of the project.
 * In the schema of a context, the jobs of that context travel with it when it is extracted as a
 * service.
 */
export function jobEntity(options: PostgresEntityOptions = {}): EntitySchema<JobRow> {
  const tableName = options.tableName ?? 'background_jobs';

  return new EntitySchema<JobRow>({
    name: entityName('BackgroundJob', options),
    tableName,
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    columns: jobColumns(),
    indices: [
      { name: `${tableName}_idempotency_key`, columns: ['name', 'tenantId', 'idempotencyKey'], unique: true },
      // Partial: a claim only ever looks at what is waiting or running, and finished jobs dominate.
      {
        name: `${tableName}_due_idx`,
        columns: ['queue', 'runAt', 'sequence'],
        where: "status in ('waiting', 'running')",
      },
    ],
  });
}

type JobColumns = EntitySchema<JobRow>['options']['columns'];

function jobColumns(): JobColumns {
  return {
    id: { type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
    sequence: { type: 'bigint', generated: 'increment' },
    name: { type: 'varchar', length: INDEXABLE_LENGTH },
    queue: { type: 'varchar', length: INDEXABLE_LENGTH },
    payload: { type: 'jsonb', nullable: true },
    enqueuedBy: { name: 'enqueued_by', type: 'jsonb' },
    idempotencyKey: { name: 'idempotency_key', type: 'varchar', length: INDEXABLE_LENGTH, nullable: true },
    // The empty text outside any tenant: a null would make every such key distinct.
    tenantId: { name: 'tenant_id', type: 'varchar', length: INDEXABLE_LENGTH, default: '' },
    subject: { type: 'varchar', length: INDEXABLE_LENGTH, nullable: true },
    status: { type: 'varchar', length: 16, default: 'waiting' },
    attempts: { type: 'int', default: 0 },
    runAt: { ...instant, name: 'run_at' },
    leaseUntil: { ...instant, name: 'lease_until', nullable: true },
    progress: { type: 'jsonb', nullable: true },
    checkpoint: { type: 'jsonb', nullable: true },
    lastErrorCode: { name: 'last_error_code', type: 'text', nullable: true },
    enqueuedAt: { ...instant, name: 'enqueued_at' },
    finishedAt: { ...instant, name: 'finished_at', nullable: true },
  };
}
