import type { StoredSnapshot } from '../../application/event-sourcing/stored-snapshot.js';
import type { SnapshotStore } from '../../application/ports/snapshot-store.js';

/** Reference implementation, for tests and single-process apps. */
export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots = new Map<string, StoredSnapshot>();

  async find(stream: string): Promise<StoredSnapshot | undefined> {
    const snapshot = this.snapshots.get(stream);

    return snapshot === undefined ? undefined : structuredClone(snapshot);
  }

  async save(snapshot: StoredSnapshot): Promise<void> {
    const held = this.snapshots.get(snapshot.stream);

    if (held === undefined || held.version < snapshot.version) {
      this.snapshots.set(snapshot.stream, structuredClone(snapshot));
    }
  }
}
