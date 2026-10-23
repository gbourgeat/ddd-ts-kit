import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** For what composes the application without serving it (the script that lists the routes, the architecture test of a platform wired by hand): nothing to connect to here. */
export function inertPersistence(): Persistence {
  return openPersistence();
}
