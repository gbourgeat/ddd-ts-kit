export interface AuditTablesOptions {
  /** The schema holding the tables. Without it they live in the default schema of the connection. */
  readonly schema?: string;
}
