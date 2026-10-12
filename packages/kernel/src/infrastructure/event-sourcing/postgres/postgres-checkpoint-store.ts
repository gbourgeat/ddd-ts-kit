import type { CheckpointStore } from '../../../application/ports/checkpoint-store.js';
import { ConcurrencyError } from '../../../domain/errors/concurrency-error.js';
import type { SqlRun } from '../../read-model/sql-run.js';
import type { EventStoreTablesOptions } from './event-store-tables-options.js';
import { qualifiedTable } from './qualified-table.js';

/** The checkpoints of the subscriptions on PostgreSQL, moved by a statement guarded by the position it starts from. */
export class PostgresCheckpointStore implements CheckpointStore {
  private readonly table: string;

  constructor(
    private readonly run: SqlRun,
    options: EventStoreTablesOptions = {},
  ) {
    this.table = qualifiedTable(options.schema, 'checkpoints');
  }

  async position(subscriber: string): Promise<number> {
    const [row] = await this.run(`select position from ${this.table} where subscriber = $1::text`, [subscriber]);

    return Number(row?.['position'] ?? 0);
  }

  async advance(subscriber: string, from: number, to: number): Promise<void> {
    const moved =
      from === 0
        ? await this.run(
            `insert into ${this.table} as c (subscriber, position) values ($1::text, $2::bigint)
on conflict (subscriber) do update set position = excluded.position, updated_at = now() where c.position = $3::bigint
returning subscriber`,
            [subscriber, to, from],
          )
        : await this.run(
            `update ${this.table} set position = $1::bigint, updated_at = now() where subscriber = $2::text and position = $3::bigint returning subscriber`,
            [to, subscriber, from],
          );

    if (moved.length === 0) {
      throw new ConcurrencyError(subscriber);
    }
  }
}
