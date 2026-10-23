import type { CheckpointStore } from '../../application/ports/checkpoint-store';
import type { EventStore } from '../../application/ports/event-store';
import type { SnapshotStore } from '../../application/ports/snapshot-store';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store';

/** The stores event sourcing needs in one database, to bind to their ports in the composition root. */
export interface EventSourcingStores {
  readonly events: EventStore;
  readonly snapshots: SnapshotStore;
  readonly checkpoints: CheckpointStore;
  readonly subjectKeys: SubjectKeyStore;
}
