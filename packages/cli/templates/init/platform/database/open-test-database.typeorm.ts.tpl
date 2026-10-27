import { openAsBlob } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
{{#if audit.on}}
import { auditGuardStatements } from '@ddd-ts-kit/audit/typeorm';
{{/if}}
import type { DataSource } from 'typeorm';
import { createDataSource } from '{{alias.platform}}/database/create-data-source{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if audit.on}}
import { AUDIT_SCHEMA } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/if}}

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
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
  const engine = await inProcessPostgres();
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

  return { persistence, reset: () => emptyTables(dataSource), close };
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

async function openServer(url: string): Promise<TestDatabase> {
  const dataSource = createDataSource(url);

  await dataSource.initialize();

  const persistence = persistenceOver(dataSource);

  return { persistence, reset: () => emptyTables(dataSource), close: () => persistence.close() };
}

// TypeORM creates tables, not schemas.
async function createTables(dataSource: DataSource): Promise<void> {
  for (const schema of new Set(dataSource.entityMetadatas.map((table) => table.schema))) {
    if (schema !== undefined) {
      await dataSource.query('create schema if not exists "' + schema + '"');
    }
  }

  await dataSource.synchronize();
{{#if audit.on}}

  // The guard a migration of the project holds: the trail refuses to be rewritten in the tests as in production.
  for (const statement of auditGuardStatements(AUDIT_SCHEMA)) {
    await dataSource.query(statement);
  }
{{/if}}
}

async function emptyTables(dataSource: DataSource): Promise<void> {
{{#if audit.on}}
  const names = dataSource.entityMetadatas
    .filter((table) => table.schema !== AUDIT_SCHEMA)
    .map((table) => (table.schema === undefined ? '' : '"' + table.schema + '".') + '"' + table.tableName + '"');
{{/if}}
{{#unless audit.on}}
  const names = dataSource.entityMetadatas.map(
    (table) => (table.schema === undefined ? '' : '"' + table.schema + '".') + '"' + table.tableName + '"',
  );
{{/unless}}

  await dataSource.query('truncate table ' + names.join(', ') + ' restart identity');
}
