export interface JobTableOptions {
  /**
   * The schema (PostgreSQL) holding the table; created when missing. Without it the table lives
   * in the default schema of the connection.
   */
  readonly schema?: string;
  /** Default `background_jobs`. */
  readonly table?: string;
}
