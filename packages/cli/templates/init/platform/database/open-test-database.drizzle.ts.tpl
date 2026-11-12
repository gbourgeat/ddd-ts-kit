import { openAsBlob } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { TableStatements } from '{{alias.platform}}/database/table-statements{{alias.ext}}';
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
 * PostgreSQL in process (PGlite) by default, with the tables of ./schema.ts created from their
 * Drizzle definitions (table-statements.ts): adapter and end-to-end specs need no container and
 * no migration run. With a URL, the tests run on that server instead, each call on a copy of the
 * database the URL names, which must already be migrated (`npm run db:migrate`); the migrations
 * remain what production applies.
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await inProcessPostgres();
  const statements = new TableStatements();

  for (const statement of statements.creating()) {
    await engine.exec(statement);
  }

  return {
    persistence: persistenceOver({ db: drizzle(engine), close: () => engine.close() }),
    reset: async () => {
      await engine.exec(statements.emptying());
    },
    close: () => engine.close(),
  };
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
 * A database of its own on the server, with the tables of the migrated one and none of its rows,
 * dropped at close (test/support/test-database-clone.ts): no other file, and no other run, reads
 * or empties its rows. Its pool is the share this file has of the connections of the server.
 */
async function openServer(url: string): Promise<TestDatabase> {
  const clone = await cloneDatabase(url);
  const connection = connectToDatabase(clone.url, { poolSize: clone.poolSize });
  const statements = new TableStatements();

  return {
    url: clone.url,
    persistence: persistenceOver(connection),
    reset: async () => {
      await connection.db.execute(sql.raw(statements.emptying()));
    },
    close: async () => {
      await connection.close();
      await clone.drop();
    },
  };
}
