export interface OutboxTablesOptions {
  /**
   * The schema (PostgreSQL) or database (MySQL) holding the tables; created when missing.
   * Without it the tables live in the default schema of the connection.
   */
  readonly schema?: string;
  /** Default `outbox`. */
  readonly outboxTable?: string;
  /** Default `processed_events`. */
  readonly processedEventsTable?: string;
  /** Adds `tenant_id` to the outbox, for a multi-tenant project: pair it with `KnexOutboxStore`'s `tenant`. Default false. */
  readonly tenant?: boolean;
}
