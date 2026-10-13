import type { SqlRun } from '../../read-model/sql-run.js';
import type { EventSourcingStores } from '../event-sourcing-stores.js';
import type { EventStoreTablesOptions } from './event-store-tables-options.js';
import { PostgresCheckpointStore } from './postgres-checkpoint-store.js';
import { PostgresEventStore } from './postgres-event-store.js';
import { PostgresSnapshotStore } from './postgres-snapshot-store.js';
import { PostgresSubjectKeyStore } from './postgres-subject-key-store.js';

/** The stores of event sourcing on PostgreSQL over the statements of an ORM adapter: what each adapter package hands out. */
export function postgresEventSourcing(run: SqlRun, options: EventStoreTablesOptions = {}): EventSourcingStores {
  return {
    events: new PostgresEventStore(run, options),
    snapshots: new PostgresSnapshotStore(run, options),
    checkpoints: new PostgresCheckpointStore(run, options),
    subjectKeys: new PostgresSubjectKeyStore(run, options),
  };
}
