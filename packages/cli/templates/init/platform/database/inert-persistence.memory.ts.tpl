import { openPersistence } from '{{alias.platform}}/database/open-persistence.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

/** For the scripts that only list routes: nothing to connect to here. */
export function inertPersistence(): Persistence {
  return openPersistence();
}
