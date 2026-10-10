import { createClient } from './create-client.js';
import { persistenceOver } from './persistence-over.js';
import type { Persistence } from './persistence.js';

/**
 * For the script that only lists routes: the client connects on the first query,
 * and none is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createClient('postgres://unused:unused@127.0.0.1:1/unused'));
}
