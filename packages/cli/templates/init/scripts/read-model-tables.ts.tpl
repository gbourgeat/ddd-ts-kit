import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import { readModelTables } from '{{alias.platform}}/database/read-model-tables{{alias.ext}}';

// The read model tables the application lists ({{config.platformDir}}/database/read-model-tables.ts),
// checked from the command line as the application checks them when it starts:
//   DATABASE_URL=<the database of the deployment> npm run db:read-models
// Before a deployment, on the database it is about to reach, once its migrations ran; after
// `npm run db:migrate` on an empty database, it says the same of the migrations of the project.
// It needs DATABASE_URL and no other variable of the application. It prints the tables it read,
// then each one that cannot hold the trace of a deleted row, with what keeps it from it and the
// migration to write. Exit code: 0 when every listed table is ready, 1 when one is not, 2 when
// DATABASE_URL names no database, 3 when the database could not be read.
const NOT_READY = 1;
const NO_DATABASE = 2;
const UNREAD = 3;

process.exitCode = await checked(process.env['DATABASE_URL']);

async function checked(databaseUrl = ''): Promise<number> {
  if (!URL.canParse(databaseUrl)) {
    console.error('DATABASE_URL names no database: set it to the address of the database to check.');

    return NO_DATABASE;
  }

  try {
    return await read(databaseUrl);
  } catch (error) {
    console.error(`The database could not be read: ${error instanceof Error ? error.message : String(error)}`);

    return UNREAD;
  }
}

async function read(databaseUrl: string): Promise<number> {
{{#if orm.prisma}}
  // The bounds of a transaction are those of Prisma: the check opens none.
  const persistence = await openPersistence({ databaseUrl, databaseTransaction: { waitMs: 2_000, timeoutMs: 5_000 } });
{{/if}}
{{#unless orm.prisma}}
  const persistence = {{persistence.await}}openPersistence({ databaseUrl });
{{/unless}}

  try {
    const { ready, text } = await readModelTables(persistence).report();

    console.log(text);

    return ready ? 0 : NOT_READY;
  } finally {
    await persistence.close();
  }
}
