import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** An address nothing listens on: the pool connects on the first query, and none is ever sent. */
const NO_DATABASE = 'postgres://unused:unused@127.0.0.1:1/unused';

/** For what composes the application without serving it (the script that lists the routes, the architecture test of a platform wired by hand): no database has to be reachable. */
export function inertPersistence(): Persistence {
  return openPersistence({ databaseUrl: NO_DATABASE });
}
