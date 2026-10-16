{{#if tests.vitest}}
import { existsSync, openAsBlob } from 'node:fs';
import { writeFile } from 'node:fs/promises';
{{/if}}
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { DataSource } from 'typeorm';
import { createDataSource } from '{{alias.platform}}/database/create-data-source{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

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
  const { engine, server, dataSource } = await {{#if tests.vitest}}startedInProcess(){{/if}}{{#if tests.jest}}createdInProcess(){{/if}};
  const persistence = persistenceOver(dataSource);

  const close = async (): Promise<void> => {
    await persistence.close();
    await server.stop();
    await engine.close();
  };

  return { persistence, reset: () => truncateAll(dataSource), close };
}

/** PostgreSQL in process, served over the wire protocol, and the one connection the tests reach it by. */
interface InProcess {
  readonly engine: PGlite;
  readonly server: PGLiteSocketServer;
  readonly dataSource: DataSource;
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

  await createTables(started.dataSource);

  return started;
}

async function served(engine: PGlite): Promise<InProcess> {
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });

  await server.start();

  // PGlite is one session behind every socket: a second connection would step into the transaction of the first.
  const dataSource = createDataSource('postgresql://postgres:postgres@' + server.getServerConn() + '/postgres', {
    poolSize: 1,
  });

  await dataSource.initialize();

  return { engine, server, dataSource };
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
