import { openAsBlob } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { Knex } from 'knex';
import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if audit.on}}
import { AUDIT_SCHEMA, createTables } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/if}}
{{#unless audit.on}}
import { createTables } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/unless}}
import { cloneDatabase } from '{{alias.test}}/support/test-database-clone{{alias.ext}}';

export interface TestDatabase {
  readonly persistence: Persistence;

  /**
   * On a server, the address of the copy this database is: what the configuration of an application
   * under test names, so that nothing it opens from that address reaches the migrated database.
   * Absent in process.
   */
  readonly url?: string;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite, served over the wire protocol) by default, with the tables of
 * ./schema.ts: adapter and end-to-end specs need no container. With a URL, the tests run on
 * that server instead, each call on a copy of the database the URL names, which must already be
 * migrated (`npm run db:migrate`).
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await inProcessPostgres();
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });

  await server.start();

  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const connection = connectToDatabase('postgresql://postgres:postgres@' + server.getServerConn() + '/postgres', {
    poolSize: 1,
  });

  await createTables(connection.db);

  const close = async (): Promise<void> => {
    await connection.close();
    await server.stop();
    await engine.close();
  };

  return { persistence: persistenceOver({ db: connection.db, close }), reset: () => emptyTables(connection.db), close };
}

/**
 * A copy of the cluster the global setup of the run initialised once (test/support/test-database-template.ts),
 * which spares each spec the initdb of its own; a cluster initialised here when the run names no
 * global setup. The tables are created on it by the caller, every time.
 */
async function inProcessPostgres(): Promise<PGlite> {
  const template = process.env['TEST_DATABASE_TEMPLATE'];

  return PGlite.create(template === undefined ? {} : { loadDataDir: await openAsBlob(template) });
}

/**
 * A database of its own on the server, copied from the migrated one and dropped at close
 * (test/support/test-database-clone.ts): no other file, and no other run, reads or empties its rows.
 */
async function openServer(url: string): Promise<TestDatabase> {
  const clone = await cloneDatabase(url);
  const connection = connectToDatabase(clone.url);

  return {
    url: clone.url,
    persistence: persistenceOver(connection),
    reset: () => emptyTables(connection.db),
    close: async () => {
      await connection.close();
      await clone.drop();
    },
  };
}

interface TableName {
  readonly table_schema: string;
  readonly table_name: string;
}

async function emptyTables(db: Knex): Promise<void> {
  const tables = await db<TableName>('information_schema.tables')
    .select('table_schema', 'table_name')
    .where('table_type', 'BASE TABLE')
    .whereNotIn('table_schema', ['pg_catalog', 'information_schema'{{#if audit.on}}, AUDIT_SCHEMA{{/if}}])
    .whereNot('table_name', 'like', 'knex_migrations%');

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => '"' + table.table_schema + '"."' + table.table_name + '"').join(', ');

  await db.raw('truncate table ' + names + ' restart identity');
}
