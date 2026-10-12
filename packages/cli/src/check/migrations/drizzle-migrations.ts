/** One entry of `meta/_journal.json`, as drizzle-kit writes it. */
export interface JournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
}

/** The ids drizzle-kit gives a snapshot and the snapshot it was generated from. */
export interface SnapshotLink {
  readonly id: string;
  readonly prevId: string;
}

/** The migrations folder of a drizzle-kit project, as read from the disk. */
export interface DrizzleMigrations {
  /** Relative to the project root, POSIX separators. */
  readonly folder: string;
  readonly journalText: string;
  readonly entries: readonly JournalEntry[];
  /** The tags of the `.sql` files of the folder. */
  readonly files: readonly string[];
  /** By the prefix of a tag (what precedes its first `_`). */
  readonly snapshots: ReadonlyMap<string, SnapshotLink>;
}
