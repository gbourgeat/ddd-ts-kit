import type { StoredSnapshot } from '../event-sourcing/stored-snapshot.js';

/** The last snapshot of each stream. Only the event-sourced repository uses it. */
export abstract class SnapshotStore {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.SnapshotStore' });
  }

  abstract find(stream: string): Promise<StoredSnapshot | undefined>;

  /** Keeps the snapshot unless the stream already has one of a later version. */
  abstract save(snapshot: StoredSnapshot): Promise<void>;
}
