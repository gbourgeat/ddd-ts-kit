/** The four layers a module of the model holds, each with its role folders unchanged below it. */
export const MODULE_LAYERS: readonly string[] = ['domain', 'application', 'infrastructure', 'presentation'];

/** The layers 0.86 and 0.87 put a module under (`domain/<module>/`), still read so that context-layout moves them. */
export const EARLIER_MODULE_LAYERS: readonly string[] = ['domain', 'application'];

/** The folders of `test/` whose specs follow the module of their subject: `test/unit/<module>/`. */
export const MODULE_TEST_FOLDERS: readonly string[] = ['unit', 'integration'];

/** The folder of the tests of a context, and of a module that holds its own: `<module>/test/`. */
export const TEST_FOLDER = 'test';

/**
 * The folder where a context divided into modules keeps what belongs to none of them: never a
 * module, never declared, read only in a context that declares modules.
 */
export const SHARED_FOLDER = 'shared';

/** What `shared/` holds: the database of the context, its route groups, what its specs share. No domain, no application. */
export const SHARED_FOLDERS: readonly string[] = ['infrastructure', 'presentation', TEST_FOLDER];

/** What a module can never be named: a layer, a folder of the root of a context. */
export const CONTEXT_FOLDERS: readonly string[] = [...MODULE_LAYERS, 'published-language', TEST_FOLDER];
