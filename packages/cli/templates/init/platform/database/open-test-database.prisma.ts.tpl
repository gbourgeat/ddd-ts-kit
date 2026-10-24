{{#if tests.vitest}}
import { openAsBlob } from 'node:fs';
{{/if}}
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
{{#if audit.on}}
import { auditGuardStatements } from '@ddd-ts-kit/audit/prisma';
{{/if}}
import pg from 'pg';
import type { PrismaClient } from '{{alias.generated}}/prisma/client{{alias.ext}}';
import { createClient } from '{{alias.platform}}/database/create-client{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
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
  const engine = await {{#if tests.vitest}}inProcessPostgres(){{/if}}{{#if tests.jest}}PGlite.create(){{/if}};
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

  return { persistence: persistenceOver(client), reset: () => emptyTables(client), close };
}

{{#if tests.vitest}}
/**
 * A copy of the cluster the global setup of the run initialised once (test/support/test-database-template.ts),
 * which spares each spec the initdb of its own; a cluster initialised here when the run names no
 * global setup. The tables are created on it by the caller, every time.
 */
async function inProcessPostgres(): Promise<PGlite> {
  const template = process.env['TEST_DATABASE_TEMPLATE'];

  return PGlite.create(template === undefined ? {} : { loadDataDir: await openAsBlob(template) });
}

{{/if}}
async function openServer(url: string): Promise<TestDatabase> {
  const client = createClient(url);

  return { persistence: persistenceOver(client), reset: () => emptyTables(client), close: () => client.$disconnect() };
}

async function createTables(url: string): Promise<void> {
  const connection = new pg.Client({ connectionString: url });

  await connection.connect();
  await connection.query(await readFile('generated/schema.sql', 'utf8'));
{{#if audit.on}}

  // The guard a migration of the project holds: the trail refuses to be rewritten in the tests as in production.
  for (const statement of auditGuardStatements('audit')) {
    await connection.query(statement);
  }

{{/if}}
  await connection.end();
}

interface TableName {
  readonly table_schema: string;
  readonly table_name: string;
}

async function emptyTables(client: PrismaClient): Promise<void> {
  const tables = await client.$queryRaw<TableName[]>`
    select table_schema, table_name from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema'{{#if audit.on}}, 'audit'{{/if}}) and table_name <> '_prisma_migrations'`;

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => '"' + table.table_schema + '"."' + table.table_name + '"').join(', ');

  await client.$executeRawUnsafe('truncate table ' + names + ' restart identity');
}
