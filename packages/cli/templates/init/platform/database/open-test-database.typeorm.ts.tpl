import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { DataSource } from 'typeorm';
import { createDataSource } from '{{alias.platform}}/database/create-data-source.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite, served over the wire protocol) by default, with the tables
 * created from the entity schemas: adapter and end-to-end specs need no container. With a URL,
 * the tests run on that server instead, which must already be migrated (`npm run db:migrate`).
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await PGlite.create();
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });

  await server.start();

  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const dataSource = createDataSource('postgresql://postgres:postgres@' + server.getServerConn() + '/postgres', {
    poolSize: 1,
  });

  await dataSource.initialize();
  await createTables(dataSource);

  const persistence = persistenceOver(dataSource);

  const close = async (): Promise<void> => {
    await persistence.close();
    await server.stop();
    await engine.close();
  };

  return { persistence, reset: () => truncateAll(dataSource), close };
}

async function openServer(url: string): Promise<TestDatabase> {
  const dataSource = createDataSource(url);

  await dataSource.initialize();

  const persistence = persistenceOver(dataSource);

  return { persistence, reset: () => truncateAll(dataSource), close: () => persistence.close() };
}

// TypeORM creates tables, not schemas.
async function createTables(dataSource: DataSource): Promise<void> {
  for (const schema of new Set(dataSource.entityMetadatas.map((table) => table.schema))) {
    if (schema !== undefined) {
      await dataSource.query('create schema if not exists "' + schema + '"');
    }
  }

  await dataSource.synchronize();
}

async function truncateAll(dataSource: DataSource): Promise<void> {
  const names = dataSource.entityMetadatas.map(
    (table) => (table.schema === undefined ? '' : '"' + table.schema + '".') + '"' + table.tableName + '"',
  );

  await dataSource.query('truncate table ' + names.join(', ') + ' restart identity');
}
