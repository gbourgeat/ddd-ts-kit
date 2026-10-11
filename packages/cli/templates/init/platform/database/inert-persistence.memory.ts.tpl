import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** For the scripts that only list routes: nothing to connect to here. */
export function inertPersistence(): Persistence {
  return openPersistence();
}
