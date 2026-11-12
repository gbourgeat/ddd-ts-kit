/**
 * One migration of a branch that the trunk's history would run in another order, or never:
 *
 * - `before-trunk`: the branch adds it and it sorts before the last migration of the trunk;
 * - `not-in-journal`: its file is in the folder of drizzle-kit and no entry of the journal names it.
 */
export interface MigrationOrderFinding {
  readonly kind: 'before-trunk' | 'not-in-journal';
  /** The name of the migration, without extension. */
  readonly migration: string;
  /** From the project root, POSIX separators. */
  readonly file: string;
  /** The last migration of the trunk, which this one sorts before; absent for a file out of the journal. */
  readonly trunkLast?: string;
  readonly text: string;
  readonly fix: string;
}
