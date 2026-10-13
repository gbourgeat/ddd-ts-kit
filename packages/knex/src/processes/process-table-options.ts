export interface ProcessTableOptions {
  /** The schema (PostgreSQL) holding the table; created when missing. */
  readonly schema?: string;
  /** Default `process_instances`. */
  readonly table?: string;
  /**
   * Adds `tenant_id` to the table, for a multi-tenant project: pair it with the `tenant` of
   * `KnexProcessStore`. Default false.
   */
  readonly tenant?: boolean;
}
