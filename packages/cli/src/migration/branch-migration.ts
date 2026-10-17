/** A migration of the branch that its base does not have, as the branch wrote it. */
export interface BranchMigration {
  /** Its file name without `.sql`: `20261015101500_working-add-invoices`. */
  readonly tag: string;
  readonly sql: string;
  /** Its snapshot repeats the one before it: the schema did not change, the statements were written by hand (`--custom`). */
  readonly custom: boolean;
}
