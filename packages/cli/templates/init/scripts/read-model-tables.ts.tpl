import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import { readModelTables } from '{{alias.platform}}/database/read-model-tables{{alias.ext}}';

// The read model tables the application lists ({{config.platformDir}}/database/read-model-tables.ts),
// checked from the command line as the application checks them when it starts:
//   DATABASE_URL=<the database of the deployment> npm run db:read-models
//   DATABASE_URL=<the database of a service> npm run db:read-models -- --context <context>
// Every listed table without `--context`; with it, given once per context, the tables of those
// contexts alone, as a context run as a service of its own checks them on its database.
// Before a deployment, on the database it is about to reach, once its migrations ran; after
// `npm run db:migrate` on an empty database, it says the same of the migrations of the project.
// It needs DATABASE_URL and no other variable of the application; a `.env` file gives it when the
// command line does not, so it prints the database it read, never its credentials. Then the
// tables it read and each one that cannot hold the trace of a deleted row, or that it could not
// read, with what keeps it from it and the migration to write. Exit code: 0 when every listed
// table is ready, 1 when one is not, 2 when DATABASE_URL names no database, 3 when no table
// could be read (the database does not answer, or refuses the reading).
const NOT_READY = 1;
const NO_DATABASE = 2;
const UNREAD = 3;

process.exitCode = await checked(process.env['DATABASE_URL'], contextsOf(process.argv));

/** The contexts named after `--context`; none, every context. */
function contextsOf(args: readonly string[]): readonly string[] | undefined {
  const named = args.filter((_, index) => args[index - 1] === '--context');

  return named.length === 0 ? undefined : named;
}

async function checked(databaseUrl = '', contexts?: readonly string[]): Promise<number> {
  if (!URL.canParse(databaseUrl)) {
    console.error('DATABASE_URL names no database: set it to the address of the database to check.');

    return NO_DATABASE;
  }

  try {
    return await read(databaseUrl, contexts);
  } catch (error) {
    console.error(`The database could not be read: ${error instanceof Error ? error.message : String(error)}`);

    return UNREAD;
  }
}

async function read(databaseUrl: string, contexts?: readonly string[]): Promise<number> {
  const { host, pathname } = new URL(databaseUrl);
  const scope = contexts === undefined ? 'every context' : contexts.join(', ');

  console.log(`Database ${pathname.slice(1)} on ${host}, ${scope}.`);

{{#if orm.prisma}}
  // The bounds of a transaction are those of Prisma: the check opens none.
  const persistence = await openPersistence({ databaseUrl, databaseTransaction: { waitMs: 2_000, timeoutMs: 5_000 } });
{{/if}}
{{#unless orm.prisma}}
  const persistence = {{persistence.await}}openPersistence({ databaseUrl });
{{/unless}}

  try {
    const { outcome, text } = await readModelTables(persistence, contexts).report();

    console.log(text);

    return { ready: 0, 'not-ready': NOT_READY, unread: UNREAD }[outcome];
  } finally {
    await persistence.close();
  }
}
