import {
  AsyncLocalStorageExecutionScope,
  ReadModelTables,
  type ExecutionScope,
  type ReadModelInATable,
} from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/**
 * The class of a read model store, built as the application binds it: on the storage, with the
 * scope of the work when it keeps tenant data.
 */
type Store = new (database: Persistence['database'], scope: ExecutionScope) => ReadModelInATable;

/**
 * The bounded contexts of the project: `generate context` adds each. An entry of the list names
 * one of them, or does not compile.
 */
type Contexts = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

/**
 * The read models the application keeps in a table: the context each belongs to and the class of
 * its store. `generate read-model` adds its store here, and `init` those it finds in the tree; a
 * store written by hand is added by hand, or `ddd-ts-kit check` reports it
 * (`persistence/read-model-listed`). A table that is not listed is never read. A store left
 * out on purpose is a comment between the two markers below that holds `<context>: <Store>` and
 * the reason: `init` then leaves it out, and the check says nothing of it. `init --force` keeps
 * what the markers of this file hold and nothing else: a comment, or a class, written anywhere
 * else is lost, and such a comment leaves nothing out.
 */
const LISTED: readonly (readonly [context: Contexts[number], store: Store])[] = [
  // ddd-ts-kit:read-model-tables
  // /ddd-ts-kit:read-model-tables
];

/**
 * The read model stores of the tree `init` could not list, `<context>: <Store>`, since their
 * constructor takes something else: the check says at each start that nothing checks their
 * tables, until each is listed through a class that builds it, written beside the store.
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

  const listed = LISTED.map(([context, Store]) => ({
    context,
    name: Store.name,
    build: () => new Store(persistence.database, scope),
  }));

  return new ReadModelTables(listed, NOT_LISTED).hosting(contexts);
}
