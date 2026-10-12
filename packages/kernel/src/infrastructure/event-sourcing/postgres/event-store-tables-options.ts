/** Where the tables of an event store live in PostgreSQL. */
export interface EventStoreTablesOptions {
  /** The schema of the bounded context; created when missing. Without it, the default schema of the connection. */
  readonly schema?: string;
}
