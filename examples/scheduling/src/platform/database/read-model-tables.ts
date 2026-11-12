import {
  AsyncLocalStorageExecutionScope,
  ReadModelTables,
  type ExecutionScope,
  type ReadModelInATable,
} from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
// ddd-ts-kit:imports
import { KnexOutcomeRegister } from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexAgenda } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-agenda.repository';
import { KnexAttendanceHistory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-attendance-history.repository';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-practitioner-directory.repository';
// /ddd-ts-kit:imports

/**
 * The class of a read model store, built as the application binds it: on the storage, with the
 * scope of the work when it keeps tenant data.
 */
type Store = new (database: Persistence['database'], scope: ExecutionScope) => ReadModelInATable;

/**
 * The read models the application keeps in a table: the context each belongs to and the class of
 * its store. `generate read-model` adds its store here, and `init` those it finds in the tree; a
 * store written by hand is added by hand. A table that is not listed is never read.
 */
const LISTED: readonly (readonly [context: string, store: Store])[] = [
  // ddd-ts-kit:read-model-tables
  ['scheduling', KnexPractitionerDirectory],
  ['scheduling', KnexAgenda],
  ['scheduling', KnexAttendanceHistory],
  ['notification', KnexContacts],
  ['analytics', KnexOutcomeRegister],
  // /ddd-ts-kit:read-model-tables
];

/**
 * The read model stores of the tree `init` could not list, since their constructor takes
 * something else: the check says at each start that nothing checks their tables, until each is
 * listed through a class of its own that builds it.
 */
const NOT_LISTED: readonly string[] = [
  // ddd-ts-kit:read-models-not-listed
  // /ddd-ts-kit:read-models-not-listed
];

/**
 * The listed tables of these contexts, every context when none is named, checked in one pass:
 * each is read by its own store, with the code that store runs before its first trace, so the
 * verdict is the store's and the migration of a table that is not ready names the columns the
 * store maps and no other. An application asks it when it starts, of the contexts it hosts: a
 * context run as a service of its own checks its tables, on its database, and no other.
 * `npm run db:read-models` asks it of the database a deployment is about to reach. The scope a
 * store of tenant data is given is never read by the check.
 */
export function readModelTables(persistence: Persistence, contexts?: readonly string[]): ReadModelTables {
  const scope = new AsyncLocalStorageExecutionScope();
  const hosted = LISTED.filter(([context]) => contexts?.includes(context) ?? true);

  return new ReadModelTables(
    hosted.map(([, Store]) => ({ name: Store.name, build: () => new Store(persistence.database, scope) })),
    NOT_LISTED,
  );
}
