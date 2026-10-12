import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { Knex } from 'knex';
import { connectToDatabase } from '@/platform/database/connect-to-database';
import { persistenceOver } from '@/platform/database/persistence-over';
import type { Persistence } from '@/platform/database/persistence';
import { AUDIT_SCHEMA, createTables } from '@/platform/database/schema';
import { upgradeTables } from '@/platform/database/upgrade-tables';

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table but the audit trail, which is append-only whoever asks: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite, served over the wire protocol) by default, with the tables of
 * ./schema.ts: adapter and end-to-end specs need no container. The `btree_gist` extension is loaded
 * into it, so a table may `create extension if not exists btree_gist` and exclude overlapping ranges. With a URL, the tests run on
 * that server instead, which must already be migrated (`npm run db:migrate`).
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await PGlite.create({ extensions: { btree_gist } });
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });

  await server.start();

  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const connection = connectToDatabase('postgresql://postgres:postgres@' + server.getServerConn() + '/postgres', {
    poolSize: 1,
  });

  await createTables(connection.db);
  await upgradeTables(connection.db);

  const close = async (): Promise<void> => {
    await connection.close();
    await server.stop();
    await engine.close();
  };

  return { persistence: persistenceOver(connection.db, close), reset: () => truncateAll(connection.db), close };
}

async function openServer(url: string): Promise<TestDatabase> {
  const connection = connectToDatabase(url);

  return {
    persistence: persistenceOver(connection.db, () => connection.close()),
    reset: () => truncateAll(connection.db),
    close: () => connection.close(),
  };
}

interface TableName {
  readonly table_schema: string;
  readonly table_name: string;
}

async function truncateAll(db: Knex): Promise<void> {
  const tables = await db<TableName>('information_schema.tables')
    .select('table_schema', 'table_name')
    .where('table_type', 'BASE TABLE')
    .whereNotIn('table_schema', ['pg_catalog', 'information_schema', AUDIT_SCHEMA])
    .whereNot('table_name', 'like', 'knex_migrations%');

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => '"' + table.table_schema + '"."' + table.table_name + '"').join(', ');

  await db.raw('truncate table ' + names + ' restart identity');
}
