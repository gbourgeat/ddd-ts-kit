import { AsyncLocalStorageExecutionScope, ReadModelTables, type ReadModelInATable } from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
// ddd-ts-kit:imports
import { KnexOutcomeRegister } from '@/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexAgenda } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-agenda.repository';
import { KnexAttendanceHistory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-attendance-history.repository';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-practitioner-directory.repository';
// /ddd-ts-kit:imports

/**
 * The read models the application keeps in a table, each built as the application binds it: the
 * store class of its context, on the storage it is given. `generate read-model` adds its store
 * here; a store written by hand is added by hand, a read model of tenant data with any execution
 * scope, which the check never reads. A table that is not listed is never read.
 */
const LISTED: readonly ((persistence: Persistence) => ReadModelInATable)[] = [
  // ddd-ts-kit:read-model-tables
  ({ database }) => new KnexPractitionerDirectory(database, new AsyncLocalStorageExecutionScope()),
  ({ database }) => new KnexAgenda(database, new AsyncLocalStorageExecutionScope()),
  ({ database }) => new KnexAttendanceHistory(database),
  ({ database }) => new KnexContacts(database, new AsyncLocalStorageExecutionScope()),
  ({ database }) => new KnexOutcomeRegister(database, new AsyncLocalStorageExecutionScope()),
  // /ddd-ts-kit:read-model-tables
];

/**
 * The listed tables, checked in one pass: each is read by its own store, with the code that store
 * runs before its first trace, so it is found ready exactly when the store will take the trace of
 * a deleted row, and the migration of one that is not names the columns the store maps and no
 * other. The application asks it when it starts, whenever its stores are built, and
 * `npm run db:read-models` asks it of the database a deployment is about to reach.
 */
export function readModelTables(persistence: Persistence): ReadModelTables {
  return new ReadModelTables(LISTED.map((build) => () => build(persistence)));
}
