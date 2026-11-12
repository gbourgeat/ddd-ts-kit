import { ReadModelTablesNotReadyError } from '@ddd-ts-kit/kernel';
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import { readModelTables } from '{{alias.platform}}/database/read-model-tables{{alias.ext}}';

// The read model tables of a database, checked from the command line as the application checks
// them when it starts:
//   DATABASE_URL=<the database of the deployment> npm run db:read-models
// Before a deployment, on the database it is about to reach, once its migrations ran: every table
// that cannot hold the trace of a deleted row is listed, with the columns that refuse NULL and the
// migration to write, and the exit code is 1. Run after `npm run db:migrate` on an empty database,
// it says the same of the migrations of the project. It reads the catalog alone: no row, no lock.
const persistence = {{persistence.await}}openPersistence(loadConfig(process.env));

try {
  const unready = await readModelTables(persistence).notReady();

  console.log(
    unready.length === 0
      ? 'Every read model table can hold the trace of a deleted row.'
      : new ReadModelTablesNotReadyError(unready).message,
  );

  process.exitCode = unready.length === 0 ? 0 : 1;
} finally {
  await persistence.close();
}
