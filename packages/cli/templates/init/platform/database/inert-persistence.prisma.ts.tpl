import { createClient } from '{{alias.platform}}/database/create-client.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

/**
 * For the script that only lists routes: the client connects on the first query,
 * and none is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createClient('postgres://unused:unused@127.0.0.1:1/unused'));
}
