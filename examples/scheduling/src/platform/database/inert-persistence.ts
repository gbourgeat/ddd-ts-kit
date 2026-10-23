import { openPersistence } from '@/platform/database/open-persistence';
import type { Persistence } from '@/platform/database/persistence';

/** An address nothing listens on: the pool connects on the first query, and none is ever sent. */
const NO_DATABASE = 'postgres://unused:unused@127.0.0.1:1/unused';

/** For what composes the application without serving it (the script that lists the routes): no database has to be reachable. */
export function inertPersistence(): Persistence {
  return openPersistence({ databaseUrl: NO_DATABASE });
}
