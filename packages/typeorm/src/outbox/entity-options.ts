import type { TypeOrmDialect } from '../columns/type-orm-dialect';

export interface EntityOptions {
  /**
   * The schema (PostgreSQL) or database (MySQL) holding the table. Without it the table lives
   * in the default schema of the connection.
   */
  readonly schema?: string;
  /** Default `postgres`. */
  readonly dialect?: TypeOrmDialect;
  /** Default `outbox` or `processed_events`. */
  readonly tableName?: string;
  /**
   * The entity name, unique in a data source. Default `OutboxRecord` or `ProcessedEvent`,
   * suffixed with the schema when one is given, so each context gets an entity of its own.
   */
  readonly name?: string;
}
