/** What one run of drizzle-kit, or a replay, wrote under the migrations folder of a project. */
export interface WrittenMigration {
  readonly root: string;
  /** Relative to the project root, POSIX separators. */
  readonly paths: readonly string[];
  /** Every file of the migrations folder and of its `meta/` once written, by path: the snapshots a SQL file follows. */
  readonly files: ReadonlyMap<string, string>;
}
