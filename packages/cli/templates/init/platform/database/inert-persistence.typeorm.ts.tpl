import { createDataSource } from '{{alias.platform}}/database/create-data-source.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

/**
 * For the script that only lists routes: the data source is never initialised,
 * and no query is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createDataSource('postgres://unused:unused@127.0.0.1:1/unused'));
}
