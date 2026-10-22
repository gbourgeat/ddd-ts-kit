import type { SqlRun } from '../../read-model/sql-run';
import type { EventSourcingStores } from '../event-sourcing-stores';
import type { EventStoreTablesOptions } from './event-store-tables-options';
import { PostgresCheckpointStore } from './postgres-checkpoint-store';
import { PostgresEventStore } from './postgres-event-store';
import { PostgresSnapshotStore } from './postgres-snapshot-store';
import { PostgresSubjectKeyStore } from './postgres-subject-key-store';

/** The stores of event sourcing on PostgreSQL over the statements of an ORM adapter: what each adapter package hands out. */
export function postgresEventSourcing(run: SqlRun, options: EventStoreTablesOptions = {}): EventSourcingStores {
  return {
    events: new PostgresEventStore(run, options),
    snapshots: new PostgresSnapshotStore(run, options),
    checkpoints: new PostgresCheckpointStore(run, options),
    subjectKeys: new PostgresSubjectKeyStore(run, options),
  };
}
