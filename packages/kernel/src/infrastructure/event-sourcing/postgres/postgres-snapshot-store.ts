import type { StoredSnapshot } from '../../../application/event-sourcing/stored-snapshot';
import type { SnapshotStore } from '../../../application/ports/snapshot-store';
import type { SqlRun } from '../../read-model/sql-run';
import type { EventStoreTablesOptions } from './event-store-tables-options';
import { qualifiedTable } from './qualified-table';
import { storedDataFrom } from './stored-data-from';

/** The snapshots of the streams on PostgreSQL: one row per stream, never replaced by an older version. */
export class PostgresSnapshotStore implements SnapshotStore {
  private readonly table: string;

  constructor(
    private readonly run: SqlRun,
    options: EventStoreTablesOptions = {},
  ) {
    this.table = qualifiedTable(options.schema, 'snapshots');
  }

  async find(stream: string): Promise<StoredSnapshot | undefined> {
    const [row] = await this.run(
      `select stream, version, schema_version, data from ${this.table} where stream = $1::text`,
      [stream],
    );

    return row === undefined
      ? undefined
      : {
          stream,
          version: Number(row['version']),
          schemaVersion: Number(row['schema_version']),
          data: storedDataFrom(row['data'], `The snapshot of ${stream}`),
        };
  }

  async save(snapshot: StoredSnapshot): Promise<void> {
    await this.run(
      `insert into ${this.table} as s (stream, version, schema_version, data) values ($1::text, $2::integer, $3::integer, $4::jsonb)
on conflict (stream) do update set version = excluded.version, schema_version = excluded.schema_version, data = excluded.data, taken_at = now()
where s.version < excluded.version`,
      [snapshot.stream, snapshot.version, snapshot.schemaVersion, JSON.stringify(snapshot.data)],
    );
  }
}
