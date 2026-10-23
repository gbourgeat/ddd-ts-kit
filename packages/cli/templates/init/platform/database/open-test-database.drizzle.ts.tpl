{{#if tests.vitest}}
import { openAsBlob } from 'node:fs';
{{/if}}
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { TableStatements } from '{{alias.platform}}/database/table-statements{{alias.ext}}';

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite) by default, with the tables of ./schema.ts created from their
 * Drizzle definitions (table-statements.ts): adapter and end-to-end specs need no container and
 * no migration run. With a URL, the tests run on that server instead, which must already be
 * migrated (`npm run db:migrate`); the migrations remain what production applies.
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const engine = await {{#if tests.vitest}}inProcessPostgres(){{/if}}{{#if tests.jest}}PGlite.create(){{/if}};
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
  const connection = connectToDatabase(url);
  const statements = new TableStatements();

  return {
    persistence: persistenceOver(connection),
    reset: async () => {
      await connection.db.execute(sql.raw(statements.emptying()));
    },
    close: () => connection.close(),
  };
}
