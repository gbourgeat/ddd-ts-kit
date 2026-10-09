import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import { createClient, type Database } from './database.js';
import { persistenceOver, type Persistence } from './persistence.js';

export interface TestDatabase {
  readonly persistence: Persistence;
  /** Empties every table: call it before each test. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite, served over the wire protocol) by default, with the tables of
 * generated/schema.sql, which `npm run db:client` derives from prisma/schema.prisma: adapter
 * and end-to-end specs need no container. With a URL, the tests run on that server instead,
 * which must already be migrated (`npm run db:migrate`).
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await PGlite.create();
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });
  await server.start();
  const url = 'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres';
  await createTables(url);
  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const client = createClient(url, { poolSize: 1 });
  const close = async (): Promise<void> => {
    await client.$disconnect();
    await server.stop();
    await engine.close();
  };
  return { persistence: persistenceOver(client), reset: () => truncateAll(client), close };
}

async function openServer(url: string): Promise<TestDatabase> {
  const client = createClient(url);
  return { persistence: persistenceOver(client), reset: () => truncateAll(client), close: () => client.$disconnect() };
}

async function createTables(url: string): Promise<void> {
  const connection = new pg.Client({ connectionString: url });
  await connection.connect();
  await connection.query(await readFile('generated/schema.sql', 'utf8'));
  await connection.end();
}

interface TableName {
  readonly table_schema: string;
  readonly table_name: string;
}

async function truncateAll(client: Database): Promise<void> {
  const tables = await client.$queryRaw<TableName[]>`
    select table_schema, table_name from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') and table_name <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const names = tables.map((table) => '"' + table.table_schema + '"."' + table.table_name + '"').join(', ');
    await client.$executeRawUnsafe('truncate table ' + names + ' restart identity');
  }
}
