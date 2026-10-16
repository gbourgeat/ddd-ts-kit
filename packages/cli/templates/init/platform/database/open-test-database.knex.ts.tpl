{{#if tests.vitest}}
import { existsSync, openAsBlob } from 'node:fs';
import { writeFile } from 'node:fs/promises';
{{/if}}
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { Knex } from 'knex';
import { connectToDatabase, type DatabaseConnection } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if audit.on}}
import { AUDIT_SCHEMA, createTables } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/if}}
{{#unless audit.on}}
import { createTables } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/unless}}

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite, served over the wire protocol) by default, with the tables of
 * ./schema.ts: adapter and end-to-end specs need no container. With a URL, the tests run on
 * that server instead, which must already be migrated (`npm run db:migrate`).
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const started = await {{#if tests.vitest}}startedInProcess(){{/if}}{{#if tests.jest}}createdInProcess(){{/if}};
  const { db } = started.connection;

  const close = async (): Promise<void> => {
    await started.disconnect();
    await started.engine.close();
  };

  return { persistence: persistenceOver(db, close), reset: () => truncateAll(db), close };
}

/** PostgreSQL in process, served over the wire protocol, and the one connection the tests reach it by. */
interface InProcess {
  readonly engine: PGlite;
  readonly connection: DatabaseConnection;

  /** Closes the connection and the server; the engine stays open. */
  disconnect(): Promise<void>;
}
{{#if tests.vitest}}

/**
 * Names the file of the template database of the run: set by its global setup,
 * test/support/test-database-template.ts, before any spec starts.
 */
const TEMPLATE = 'TEST_DATABASE_TEMPLATE';

/**
 * A copy of the template database of the run. The first opening of a run, that of its global setup,
 * creates the database and saves it as the template; with no template named, each opening creates its own.
 */
async function startedInProcess(): Promise<InProcess> {
  const template = process.env[TEMPLATE];

  if (template !== undefined && existsSync(template)) {
    return served(await PGlite.create({ loadDataDir: await openAsBlob(template) }));
  }

  const started = await createdInProcess();

  if (template !== undefined) {
    await writeFile(template, new Uint8Array(await (await started.engine.dumpDataDir('none')).arrayBuffer()));
  }

  return started;
}
{{/if}}

async function createdInProcess(): Promise<InProcess> {
  const started = await served(await PGlite.create());

  await createTables(started.connection.db);

  return started;
}

async function served(engine: PGlite): Promise<InProcess> {
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });

  await server.start();

  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const connection = connectToDatabase('postgresql://postgres:postgres@' + server.getServerConn() + '/postgres', {
    poolSize: 1,
  });

  const disconnect = async (): Promise<void> => {
    await connection.close();
    await server.stop();
  };

  return { engine, connection, disconnect };
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
    .whereNotIn('table_schema', ['pg_catalog', 'information_schema'{{#if audit.on}}, AUDIT_SCHEMA{{/if}}])
    .whereNot('table_name', 'like', 'knex_migrations%');

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => '"' + table.table_schema + '"."' + table.table_name + '"').join(', ');

  await db.raw('truncate table ' + names + ' restart identity');
}
