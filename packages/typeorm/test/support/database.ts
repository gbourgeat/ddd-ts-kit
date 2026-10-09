import { DataSource, type EntitySchema, type Logger } from 'typeorm';
import { startPostgres } from './postgres.js';

/** A TypeORM logger that keeps the SQL it was given, to assert what was really sent. */
export class RecordingLogger implements Logger {
  readonly queries: string[] = [];

  logQuery(query: string): void {
    this.queries.push(query);
  }

  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

export interface TestDatabase {
  readonly dataSource: DataSource;
  /** True on a real server, where several connections make real concurrency possible. */
  readonly real: boolean;
  /** The SQL TypeORM sent since the last truncate. */
  readonly queries: string[];
  truncate(): Promise<void>;
  close(): Promise<void>;
}

/**
 * One PostgreSQL database with the tables of the given entities, created from their
 * `EntitySchema` the way a generated migration would.
 */
export async function createDatabase(
  entities: readonly EntitySchema[],
): Promise<TestDatabase> {
  const postgres = await startPostgres();
  const logger = new RecordingLogger();
  const dataSource = new DataSource({
    type: 'postgres',
    url: postgres.url,
    entities: [...entities],
    poolSize: postgres.poolSize,
    logger,
  });
  await dataSource.initialize();
  const tables = entities.map((entity) => dataSource.getMetadata(entity));
  for (const schema of new Set(tables.map((table) => table.schema))) {
    if (schema !== undefined) {
      await dataSource.query(`create schema if not exists "${schema}"`);
    }
  }
  await dataSource.synchronize();
  const targets = tables
    .map((table) => [table.schema, table.tableName].filter((part) => part !== undefined))
    .map((parts) => parts.map((part) => `"${part}"`).join('.'));
  return {
    dataSource,
    real: postgres.real,
    queries: logger.queries,
    truncate: async () => {
      await dataSource.query(`truncate table ${targets.join(', ')} restart identity`);
      logger.queries.length = 0;
    },
    close: async () => {
      await dataSource.destroy();
      await postgres.stop();
    },
  };
}
