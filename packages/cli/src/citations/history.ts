/** A file of the code that was removed: deleted, or renamed. */
export interface Removal {
  /** Relative to the project root. */
  readonly path: string;
  /** The ref where the file still exists: the parent of the commit that removed it, or the merge base of a change. */
  readonly before: string;
  /** The commit that removed it, with its day and subject; left out for a change not committed yet. */
  readonly commit?: string;
  readonly date?: string;
  readonly subject?: string;
  /** Where git saw the file go. */
  readonly renamedTo?: string;
  /** The files added by the same commit, or by the same change. */
  readonly addedWith: readonly string[];
}

/** What git says the code lost and gained. */
export interface History {
  /** The last removal of each path, the most recent first. */
  readonly removals: ReadonlyMap<string, Removal>;
  /** When each path was last added or renamed into, as a commit time in seconds. */
  readonly added: ReadonlyMap<string, number>;
}
