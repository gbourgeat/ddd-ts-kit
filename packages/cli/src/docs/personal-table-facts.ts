/** What one `personalFields` declaration of a context says: a table, the person its rows are about, what it keeps of them, and for how long. */
export interface PersonalTableFacts {
  /** The file of the declaration, from the root of the project. */
  readonly file: string;
  /** The table as the database names it, or the expression the declaration passes when it cannot be read. */
  readonly table: string;
  /** The column that names the data subject. */
  readonly subject: string;
  readonly fields: readonly string[];
  /** The columns that hold the keys of files about the person. */
  readonly files: readonly string[];
  /** What an erasure does: `pseudonymise` or `row`. */
  readonly erasure: string;
  /** `36 months after ends_at`, `configured by RETENTION_PERIODS` when the project reads it from configuration, absent when the rows are kept until the person asks. */
  readonly retention?: string;
}
