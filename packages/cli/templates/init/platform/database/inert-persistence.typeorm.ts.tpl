import { createDataSource } from '{{alias.platform}}/database/create-data-source{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** An address nothing listens on: the data source is never initialised, and no query is ever sent. */
const NO_DATABASE = 'postgres://unused:unused@127.0.0.1:1/unused';

/** For what composes the application without serving it (the script that lists the routes, the architecture test of a platform wired by hand): no database has to be reachable. */
export function inertPersistence(): Persistence {
  return persistenceOver(createDataSource(NO_DATABASE));
}
