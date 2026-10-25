export interface ProcessTableOptions {
  /** The schema (PostgreSQL) holding the table; created when missing. */
  readonly schema?: string;
  /** Default `process_instances`. */
  readonly table?: string;
}
