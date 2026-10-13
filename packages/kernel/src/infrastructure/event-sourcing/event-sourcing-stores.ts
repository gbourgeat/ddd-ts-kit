import type { CheckpointStore } from '../../application/ports/checkpoint-store.js';
import type { EventStore } from '../../application/ports/event-store.js';
import type { SnapshotStore } from '../../application/ports/snapshot-store.js';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store.js';

/** The stores event sourcing needs in one database, to bind to their ports in the composition root. */
export interface EventSourcingStores {
  readonly events: EventStore;
  readonly snapshots: SnapshotStore;
  readonly checkpoints: CheckpointStore;
  readonly subjectKeys: SubjectKeyStore;
}
