import { openPersistence } from './open-persistence.js';
import type { Persistence } from './persistence.js';

/**
 * For the script that only lists routes: the pool connects on the first query,
 * and none is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return openPersistence({ databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused' });
}
