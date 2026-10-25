export interface PostgresEntityOptions {
  /** The schema holding the table. Without it the table lives in the default schema of the connection. */
  readonly schema?: string;
  /** Default `background_jobs` or `process_instances`. */
  readonly tableName?: string;
  /**
   * The entity name, unique in a data source. Default `BackgroundJob` or `ProcessInstance`,
   * suffixed with the schema when one is given, so each context gets an entity of its own.
   */
  readonly name?: string;
}
