import { createDataSource } from './create-data-source.js';
import { persistenceOver } from './persistence-over.js';
import type { Persistence } from './persistence.js';

/**
 * For the script that only lists routes: the data source is never initialised,
 * and no query is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createDataSource('postgres://unused:unused@127.0.0.1:1/unused'));
}
